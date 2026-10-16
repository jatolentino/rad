from __future__ import annotations

import csv
import io

from langchain_openai import ChatOpenAI

from app.config import settings
from app.ingest import absolute_path
from app.models import ParseVerdict, RequirementRecord
from app.services.clearance import (
    is_infection_screen,
    requirement_clears,
    status_label,
)
from app.services.langfuse import langfuse_client, langfuse_handler
from app.services.prompts import FALLBACK_PROMPT, build_prompt

__all__ = [
    "FALLBACK_PROMPT",
    "build_prompt",
    "display_name",
    "file_present",
    "is_infection_screen",
    "langfuse_client",
    "langfuse_handler",
    "make_llm",
    "parse_requirement",
    "requirement_clears",
    "status_label",
]


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
