from app.models import ParseVerdict, RequirementRecord, RequirementType
from app.services.clearance import (
    is_infection_screen,
    requirement_clears,
    status_label,
)


def _req(name: str, kind: RequirementType = "email") -> RequirementRecord:
    return RequirementRecord(name=name, type=kind, path="data/example")


def test_infection_screen_names():
    assert is_infection_screen("Hep B titer")
    assert is_infection_screen("Hepatitis B")
    assert is_infection_screen("TB test")
    assert is_infection_screen("tuberculosis")
    assert not is_infection_screen("Forklift cert")
    assert not is_infection_screen("Drug test")
    assert not is_infection_screen("I-9")


def test_status_label_missing_when_document_absent():
    verdict = ParseVerdict(is_there_one=False, result="approved")
    assert status_label(verdict, _req("I-9")) == "missing"


def test_status_label_infection_keeps_positive_and_negative():
    hep = _req("Hep B titer")
    assert (
        status_label(ParseVerdict(is_there_one=True, result="positive"), hep)
        == "positive"
    )
    assert (
        status_label(ParseVerdict(is_there_one=True, result="negative"), hep)
        == "negative"
    )
    assert (
        status_label(ParseVerdict(is_there_one=True, result="approved"), hep)
        == "denied"
    )


def test_status_label_maps_not_approved_and_negative_drug_to_words():
    cert = _req("Forklift cert", "certificate")
    drug = _req("Drug test", "test")
    assert (
        status_label(ParseVerdict(is_there_one=True, result="approved"), cert)
        == "approved"
    )
    assert (
        status_label(ParseVerdict(is_there_one=True, result="negative"), drug)
        == "approved"
    )
    assert (
        status_label(ParseVerdict(is_there_one=True, result="denied"), cert)
        == "denied"
    )


def test_requirement_clears_matches_desk_rules():
    assert requirement_clears("negative", "Hep B titer")
    assert not requirement_clears("positive", "TB test")
    assert not requirement_clears("approved", "Hep B titer")
    assert requirement_clears("approved", "Forklift cert")
    assert not requirement_clears("negative", "Drug test")
    assert not requirement_clears(None, "I-9")
    assert not requirement_clears("missing", "I-9")
