from __future__ import annotations

import re

from app.models import ParseVerdict, RequirementRecord, ResultLabel


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
