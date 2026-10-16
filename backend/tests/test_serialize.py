from app.db import serialize_workers
from app.models import RequirementRecord, WorkerRecord


def test_serialize_workers_sets_complete_and_error():
    worker = WorkerRecord(
        id="1",
        worker="Amy_Z",
        role="Phlebotomist",
        requirements={
            "req1": RequirementRecord(
                name="I-9",
                type="email",
                path="data/emails/amy-z-i9.txt",
                status="approved",
            )
        },
    )
    snapshot = serialize_workers([worker], complete=True, error=None)
    assert snapshot["complete"] is True
    assert snapshot["error"] is None
    assert snapshot["workers"][0]["requirements"]["req1"]["status"] == "approved"

    failed = serialize_workers([worker], complete=False, error="parse failed")
    assert failed["complete"] is False
    assert failed["error"] == "parse failed"
