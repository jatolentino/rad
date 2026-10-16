import json

from app.config import settings
from app.ingest import absolute_path, build_preprocessed, load_roster, worker_key
from app.models import KIND_TO_TYPE


def test_worker_key_matches_frontend_roster_key():
    assert worker_key("Amy Z.") == "Amy_Z"
    assert worker_key("Jon C.") == "Jon_C"


def test_load_roster_requires_create(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "data_dir", tmp_path)
    try:
        load_roster()
        raise AssertionError("expected FileNotFoundError")
    except FileNotFoundError as error:
        assert "Click Create first" in str(error)


def test_absolute_path_strips_data_prefix(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "data_dir", tmp_path)
    assert absolute_path("data/certs/forklift/jon-c.md") == tmp_path / "certs/forklift/jon-c.md"
    assert absolute_path("emails/amy-z-hep-b.txt") == tmp_path / "emails/amy-z-hep-b.txt"


def test_build_preprocessed_maps_roster_with_null_status(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "data_dir", tmp_path)
    roster = {
        "workers": [
            {
                "name": "Amy Z.",
                "roleTitle": "Phlebotomist",
                "requirements": [
                    {
                        "label": "Phlebotomy cert",
                        "kind": "cert",
                        "expectedPath": "certs/phlebotomy/amy-z.md",
                    },
                    {
                        "label": "Hep B titer",
                        "kind": "email",
                        "expectedPath": "emails/amy-z-hep-b.txt",
                    },
                    {
                        "label": "Drug test",
                        "kind": "drug_test",
                        "expectedPath": "tests/test.csv",
                    },
                ],
            }
        ]
    }
    (tmp_path / "roster.json").write_text(json.dumps(roster), encoding="utf-8")

    workers = build_preprocessed()
    assert len(workers) == 1
    assert workers[0].worker == "Amy_Z"
    assert workers[0].role == "Phlebotomist"
    assert set(workers[0].requirements) == {"req1", "req2", "req3"}
    assert workers[0].requirements["req1"].type == KIND_TO_TYPE["cert"]
    assert workers[0].requirements["req1"].path == "data/certs/phlebotomy/amy-z.md"
    assert workers[0].requirements["req1"].status is None
    assert workers[0].requirements["req2"].type == "email"
    assert workers[0].requirements["req3"].type == "test"
