from __future__ import annotations

import logging

from app.models import RequirementRecord
from app.services.langfuse import langfuse_client, langfuse_host

logger = logging.getLogger(__name__)

FALLBACK_PROMPT = """You extract the outcome of one staffing clearance document.

Worker: {worker_name}
Requirement: {requirement_name}
Type: {requirement_type}

Document:
{document}

Return:
- is_there_one: true only if this document is about this worker and this requirement.
- result: one of positive, negative, approved, denied, missing.

Result rules:
- Hepatitis B / Hep B / TB: use positive or negative. Positive means the worker HAS the infection. Negative means they do not. Do not treat 'processed' or 'documented' as negative or approved.
- Certificates, I-9, background checks, drug tests: use approved if the credential is currently valid (unexpired cert, completed I-9, clear background, negative drug screen). Otherwise denied.
- If the document does not state a real outcome, use denied (or missing if there is no usable document).
"""

_logged_prompt_source = False


def local_prompt(
    worker_name: str,
    requirement: RequirementRecord,
    document: str,
) -> str:
    return FALLBACK_PROMPT.format(
        worker_name=worker_name,
        requirement_name=requirement.name,
        requirement_type=requirement.type,
        document=document[:12000],
    )


def build_prompt(
    worker_name: str,
    requirement: RequirementRecord,
    document: str,
) -> str:
    """Langfuse prompt if it exists; otherwise the local fallback."""
    global _logged_prompt_source
    local = local_prompt(worker_name, requirement, document)
    client = langfuse_client()
    if client is None:
        return local
    try:
        prompt = client.get_prompt("parse-requirement")
        compiled = prompt.compile(
            worker_name=worker_name,
            requirement_name=requirement.name,
            requirement_type=requirement.type,
            document=document[:12000],
        )
        if not _logged_prompt_source:
            _logged_prompt_source = True
            logger.info(
                "Using Langfuse prompt 'parse-requirement' from %s",
                langfuse_host(),
            )
        return f"{compiled}\n\n{local}"
    except Exception:
        logger.info("Langfuse prompt missing; using the local parse prompt.")
        return local
