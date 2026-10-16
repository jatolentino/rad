import asyncio
from unittest.mock import MagicMock

from app.config import settings
from app.models import ParseVerdict, RequirementRecord
from app.parse import (
    csv_row_document,
    display_name,
    file_present,
    matching_csv_row,
    parse_requirement,
)


def test_display_name_restores_last_initial():
    assert display_name("Amy_Z") == "Amy Z."
    assert display_name("Jon_C") == "Jon C."
    assert display_name("Amy Z.") == "Amy Z."
    assert display_name("Home_Health") == "Home Health"


def test_matching_csv_row_is_case_insensitive_and_strips_quotes():
    csv_text = 'worker,panel,result\n"Amy Z.",5-panel,negative\n'
    row = matching_csv_row(csv_text, "amy z.")
    assert row is not None
    assert row["result"] == "negative"
    assert matching_csv_row(csv_text, "Jon C.") is None


def test_csv_row_document_is_plain_text_for_the_llm():
    text = csv_row_document({"worker": "Amy Z.", "result": "negative"})
    assert "worker: Amy Z." in text
    assert "result: negative" in text


def test_file_present_missing_file(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "data_dir", tmp_path)
    requirement = RequirementRecord(
        name="Forklift cert",
        type="certificate",
        path="data/certs/forklift/jon-c.md",
    )
    present, text = file_present(requirement, "Jon C.")
    assert present is False
    assert text == ""


def test_file_present_reads_certificate(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "data_dir", tmp_path)
    path = tmp_path / "certs" / "forklift" / "jon-c.md"
    path.parent.mkdir(parents=True)
    path.write_text("# Forklift\nStatus: valid\n", encoding="utf-8")
    requirement = RequirementRecord(
        name="Forklift cert",
        type="certificate",
        path="data/certs/forklift/jon-c.md",
    )
    present, text = file_present(requirement, "Jon C.")
    assert present is True
    assert "Status: valid" in text


def test_file_present_csv_without_matching_worker_is_absent(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "data_dir", tmp_path)
    path = tmp_path / "tests" / "test.csv"
    path.parent.mkdir(parents=True)
    path.write_text("worker,result\nJon C.,negative\n", encoding="utf-8")
    requirement = RequirementRecord(
        name="Drug test",
        type="test",
        path="data/tests/test.csv",
    )
    present, text = file_present(requirement, "Amy Z.")
    assert present is False
    assert "Jon C." in text


def test_parse_requirement_skips_llm_when_file_is_missing(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "data_dir", tmp_path)

    def fail_llm():
        raise AssertionError("LLM should not run for a missing file")

    monkeypatch.setattr("app.parse.make_llm", fail_llm)
    requirement = RequirementRecord(
        name="I-9",
        type="email",
        path="data/emails/amy-z-i9.txt",
    )
    verdict = asyncio.run(parse_requirement("Amy_Z", requirement))
    assert verdict == ParseVerdict(is_there_one=False, result="missing")


def test_parse_requirement_calls_llm_when_document_exists(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "data_dir", tmp_path)
    path = tmp_path / "emails" / "amy-z-i9.txt"
    path.parent.mkdir(parents=True)
    path.write_text("Section 2 verified. Eligible to work.\n", encoding="utf-8")

    llm = MagicMock()

    async def ainvoke(prompt, config=None):
        assert "Amy Z." in prompt
        assert "Eligible to work" in prompt
        return ParseVerdict(is_there_one=True, result="approved")

    llm.ainvoke = ainvoke
    monkeypatch.setattr("app.parse.make_llm", lambda: llm)
    monkeypatch.setattr("app.parse.langfuse_handler", lambda: None)

    requirement = RequirementRecord(
        name="I-9",
        type="email",
        path="data/emails/amy-z-i9.txt",
    )
    verdict = asyncio.run(parse_requirement("Amy_Z", requirement))
    assert verdict.is_there_one is True
    assert verdict.result == "approved"
