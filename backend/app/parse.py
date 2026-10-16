from __future__ import annotations

import csv
import io
import logging
import re
from langchain_openai import ChatOpenAI
from langfuse import Langfuse
from langfuse.callback import CallbackHandler

from app.config import settings
from app.ingest import absolute_path
from app.models import ParseVerdict, RequirementRecord, ResultLabel

# Local prompt is disabled so Simulate must load parse-requirement from Langfuse.
# FALLBACK_PROMPT = """You extract the outcome of one staffing clearance document.
#
# Worker: {worker_name}
# Requirement: {requirement_name}
# Type: {requirement_type}
#
# Document:
# {document}
#
# Return:
# - is_there_one: true only if this document is about this worker and this requirement.
# - result: one of positive, negative, approved, denied, missing.
#
# Result rules:
# - Hepatitis B / Hep B / TB: use positive or negative. Positive means the worker HAS the infection. Negative means they do not. Do not treat 'processed' or 'documented' as negative or approved.
# - Certificates, I-9, background checks, drug tests: use approved if the credential is currently valid (unexpired cert, completed I-9, clear background, negative drug screen). Otherwise denied.
# - If the document does not state a real outcome, use denied (or missing if there is no usable document).
# """

logger = logging.getLogger(__name__)

_langfuse: Langfuse | None = None
_langfuse_host: str | None = None
_langfuse_disabled = False
_langfuse_warned = False
_logged_prompt_source = False

LANGFUSE_HOSTS = (
    "https://us.cloud.langfuse.com",
    "https://cloud.langfuse.com",
    "https://cloud.eu.langfuse.com",
    "https://jp.cloud.langfuse.com",
)


def _candidate_hosts() -> list[str]:
    configured = (settings.langfuse_host or "").rstrip("/")
    hosts: list[str] = []
    if configured:
        hosts.append(configured)
    for host in LANGFUSE_HOSTS:
        if host not in hosts:
            hosts.append(host)
    return hosts


def langfuse_client() -> Langfuse | None:
    global _langfuse, _langfuse_host, _langfuse_disabled, _langfuse_warned
    if _langfuse_disabled:
        return None
    if not settings.langfuse_public_key or not settings.langfuse_secret_key:
        _langfuse_disabled = True
        return None
    if _langfuse is not None:
        return _langfuse
    for host in _candidate_hosts():
        client = Langfuse(
            public_key=settings.langfuse_public_key,
            secret_key=settings.langfuse_secret_key,
            host=host,
        )
        try:
            ok = bool(client.auth_check())
        except Exception:
            ok = False
        if ok:
            _langfuse = client
            _langfuse_host = host
            return _langfuse
    _langfuse_disabled = True
    if not _langfuse_warned:
        _langfuse_warned = True
        logger.warning(
            "Langfuse rejected the API keys for host %s. "
            "Set LANGFUSE_HOST to the URL in your Langfuse browser bar, "
            "for example https://us.cloud.langfuse.com (US) or "
            "https://cloud.langfuse.com (EU).",
            settings.langfuse_host,
        )
    return None


def langfuse_handler() -> CallbackHandler | None:
    if not langfuse_client() or not _langfuse_host:
        return None
    return CallbackHandler(
        public_key=settings.langfuse_public_key,
        secret_key=settings.langfuse_secret_key,
        host=_langfuse_host,
    )


def file_present(requirement: RequirementRecord, worker_name: str) -> tuple[bool, str]:
    path = absolute_path(requirement.path)
    if not path.is_file():
        return False, ""
    text = path.read_text(encoding="utf-8")
    if requirement.type != "test":
        return True, text
    row = matching_csv_row(text, worker_name)
    if row is None:
        return False, text
    return True, csv_row_document(row)


def matching_csv_row(csv_text: str, worker_name: str) -> dict[str, str] | None:
    reader = csv.DictReader(io.StringIO(csv_text))
    wanted = worker_name.strip().strip('"')
    for row in reader:
        value = (row.get("worker") or "").strip().strip('"')
        if value.lower() == wanted.lower():
            return {key: (val or "").strip().strip('"') for key, val in row.items()}
    return None


def csv_row_document(row: dict[str, str]) -> str:
    return "\n".join(f"{key}: {value}" for key, value in row.items())


def build_prompt(
    worker_name: str,
    requirement: RequirementRecord,
    document: str,
) -> str:
    global _logged_prompt_source
    client = langfuse_client()
    if client is None:
        raise RuntimeError(
            "Langfuse is not connected, so the parse prompt cannot be loaded. "
            "Check LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, and LANGFUSE_HOST."
        )
    try:
        prompt = client.get_prompt("parse-requirement")
        compiled = prompt.compile(
            worker_name=worker_name,
            requirement_name=requirement.name,
            requirement_type=requirement.type,
            document=document[:12000],
        )
    except Exception as error:
        raise RuntimeError(
            "Could not load Langfuse prompt 'parse-requirement'. "
            "Create it in Prompt Management with variables "
            "{{worker_name}}, {{requirement_name}}, {{requirement_type}}, {{document}}."
        ) from error
    if not _logged_prompt_source:
        _logged_prompt_source = True
        logger.info(
            "Using Langfuse prompt 'parse-requirement' from %s",
            _langfuse_host,
        )
    return compiled
    # return FALLBACK_PROMPT.format(
    #     worker_name=worker_name,
    #     requirement_name=requirement.name,
    #     requirement_type=requirement.type,
    #     document=document[:12000],
    # )


def make_llm() -> ChatOpenAI:
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY is missing in backend/.env")
    return ChatOpenAI(
        model=settings.openai_model,
        api_key=settings.openai_api_key,
        temperature=0,
    ).with_structured_output(ParseVerdict)


async def parse_requirement(
    worker_name: str,
    requirement: RequirementRecord,
) -> ParseVerdict:
    present, document = file_present(requirement, display_name(worker_name))
    if not present:
        return ParseVerdict(is_there_one=False, result="missing")
    llm = make_llm()
    prompt = build_prompt(display_name(worker_name), requirement, document)
    handler = langfuse_handler()
    config = {"callbacks": [handler]} if handler else {}
    verdict = await llm.ainvoke(prompt, config=config)
    if handler:
        handler.flush()
    return verdict


def display_name(worker_key: str) -> str:
    if "." in worker_key:
        return worker_key
    parts = worker_key.split("_")
    if len(parts) >= 2 and len(parts[-1]) == 1:
        return f"{' '.join(parts[:-1])} {parts[-1]}."
    return worker_key.replace("_", " ")


def is_infection_screen(name: str) -> bool:
    return bool(
        re.search(r"\b(hep(?:atitis)?(?:\s*b)?|tb|tuberculosis)\b", name, re.I)
    )


def status_label(verdict: ParseVerdict, requirement: RequirementRecord) -> ResultLabel:
    if not verdict.is_there_one:
        return "missing"
    raw = verdict.result.lower().replace("_", " ").strip()
    if raw == "not approved":
        raw = "denied"
    if is_infection_screen(requirement.name):
        if raw == "positive":
            return "positive"
        if raw == "negative":
            return "negative"
        return "denied"
    if raw in {"approved", "negative"}:
        return "approved"
    return "denied"


def requirement_clears(status: str | None, name: str) -> bool:
    if not status:
        return False
    value = status.lower()
    if is_infection_screen(name):
        return value == "negative"
    return value == "approved"
