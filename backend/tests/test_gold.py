import json
from pathlib import Path

from app.models import ParseVerdict, RequirementRecord

GOLD_PATH = Path(__file__).resolve().parents[1] / "evals" / "parse_gold.json"


def test_gold_cases_match_production_parse_schema():
    cases = json.loads(GOLD_PATH.read_text(encoding="utf-8"))
    assert len(cases) >= 8
    ids = [case["id"] for case in cases]
    assert "hep-b-processed-only" in ids
    for case in cases:
        ParseVerdict.model_validate(case["expected"])
        RequirementRecord(
            name=case["requirement_name"],
            type=case["requirement_type"],
            path="eval",
        )
        assert case["worker_name"]
        assert case["document"]
