from app.models import RequirementRecord
from app.services.prompts import FALLBACK_PROMPT, build_prompt, local_prompt


def test_local_prompt_fills_worker_requirement_and_document():
    requirement = RequirementRecord(
        name="Hep B titer",
        type="email",
        path="data/emails/amy-z-hep-b.txt",
    )
    prompt = local_prompt("Amy Z.", requirement, "Hepatitis B result: negative")
    assert "Amy Z." in prompt
    assert "Hep B titer" in prompt
    assert "email" in prompt
    assert "Hepatitis B result: negative" in prompt
    assert "processed" in FALLBACK_PROMPT


def test_build_prompt_uses_local_fallback_when_langfuse_is_off(monkeypatch):
    monkeypatch.setattr("app.services.prompts.langfuse_client", lambda: None)
    requirement = RequirementRecord(
        name="Forklift cert",
        type="certificate",
        path="data/certs/forklift/jon-c.md",
    )
    prompt = build_prompt("Jon C.", requirement, "Status: valid")
    assert prompt == local_prompt("Jon C.", requirement, "Status: valid")
