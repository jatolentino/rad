import asyncio
from unittest.mock import AsyncMock

from app.graph import (
    WORKER_CONCURRENCY,
    build_process_one,
    build_process_two,
    parse_all_node,
)
from app.models import ParseVerdict, RequirementRecord, WorkerRecord
from app.services.clearance import status_label


def test_process_graphs_keep_the_two_step_shape():
    assert WORKER_CONCURRENCY == 10
    one = build_process_one()
    two = build_process_two()
    assert "ingest" in one.nodes
    assert "persist_pre" in one.nodes
    assert "parse_all" in two.nodes
    assert "persist_processed" in two.nodes


def test_parse_all_stores_missing_when_one_requirement_raises(monkeypatch):
    async def boom(_worker, _requirement):
        raise RuntimeError("rate limit")

    monkeypatch.setattr("app.graph.parse_requirement", boom)
    monkeypatch.setattr("app.graph.save_payload", AsyncMock())

    worker = WorkerRecord(
        id="1",
        worker="Amy_Z",
        role="Phlebotomist",
        requirements={
            "req1": RequirementRecord(
                name="Phlebotomy cert",
                type="certificate",
                path="data/certs/phlebotomy/amy-z.md",
            )
        },
    )
    state = asyncio.run(parse_all_node({"workers": [worker.model_dump()]}))
    assert state["processed"][0]["requirements"]["req1"]["status"] == "missing"


def test_parse_all_writes_status_words_not_booleans(monkeypatch):
    async def fake_parse(_worker, requirement):
        if "Hep" in requirement.name:
            return ParseVerdict(is_there_one=True, result="negative")
        return ParseVerdict(is_there_one=True, result="approved")

    monkeypatch.setattr("app.graph.parse_requirement", fake_parse)
    monkeypatch.setattr("app.graph.save_payload", AsyncMock())

    worker = WorkerRecord(
        id="1",
        worker="Amy_Z",
        role="Phlebotomist",
        requirements={
            "req1": RequirementRecord(
                name="Phlebotomy cert",
                type="certificate",
                path="data/certs/phlebotomy/amy-z.md",
            ),
            "req2": RequirementRecord(
                name="Hep B titer",
                type="email",
                path="data/emails/amy-z-hep-b.txt",
            ),
        },
    )
    state = asyncio.run(parse_all_node({"workers": [worker.model_dump()]}))
    reqs = state["processed"][0]["requirements"]
    assert reqs["req1"]["status"] == status_label(
        ParseVerdict(is_there_one=True, result="approved"),
        worker.requirements["req1"],
    )
    assert reqs["req2"]["status"] == "negative"
    assert reqs["req1"]["status"] is not True
    assert reqs["req1"]["status"] is not False
