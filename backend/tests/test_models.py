from app.models import KIND_TO_TYPE, ParseVerdict, RequirementRecord, WorkersPayload


def test_kind_to_type_maps_roster_kinds_to_parse_types():
    assert KIND_TO_TYPE["cert"] == "certificate"
    assert KIND_TO_TYPE["email"] == "email"
    assert KIND_TO_TYPE["drug_test"] == "test"


def test_parse_verdict_accepts_closed_label_set():
    verdict = ParseVerdict(is_there_one=True, result="approved")
    assert verdict.is_there_one is True
    assert verdict.result == "approved"


def test_requirement_status_starts_null():
    record = RequirementRecord(
        name="I-9",
        type="email",
        path="data/emails/amy-z-i9.txt",
    )
    assert record.status is None


def test_workers_payload_defaults():
    payload = WorkersPayload()
    assert payload.workers == []
    assert payload.complete is False
    assert payload.error is None
