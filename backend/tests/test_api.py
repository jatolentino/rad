from unittest.mock import AsyncMock

from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.models import RequirementRecord, WorkerRecord

client = TestClient(app)


def test_cors_allows_the_desk_origin():
    response = client.options(
        "/api/v1/reset",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"


def test_simulate_without_roster_is_400(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "data_dir", tmp_path)
    response = client.post("/api/v1/simulate")
    assert response.status_code == 400
    assert "Create first" in response.json()["detail"]


def test_simulate_returns_process_one_without_waiting_on_parse(monkeypatch):
    worker = WorkerRecord(
        id="1",
        worker="Amy_Z",
        role="Phlebotomist",
        requirements={
            "req1": RequirementRecord(
                name="Phlebotomy cert",
                type="certificate",
                path="data/certs/phlebotomy/amy-z.md",
                status=None,
            )
        },
    )
    monkeypatch.setattr("app.main.run_process_one", AsyncMock(return_value=[worker]))
    monkeypatch.setattr("app.main.run_process_two", AsyncMock())

    response = client.post("/api/v1/simulate")
    assert response.status_code == 200
    body = response.json()
    assert body["complete"] is False
    assert body["workers"][0]["worker"] == "Amy_Z"
    assert body["workers"][0]["requirements"]["req1"]["status"] is None


def test_data_processed_returns_empty_snapshot(monkeypatch):
    monkeypatch.setattr(
        "app.main.load_payload",
        AsyncMock(return_value={"workers": [], "complete": False}),
    )
    response = client.get("/api/v1/data-processed")
    assert response.status_code == 200
    assert response.json()["workers"] == []


def test_reset_clears_simulate_collections(monkeypatch):
    drop = AsyncMock()
    monkeypatch.setattr("app.main.drop_simulate_data", drop)
    response = client.post("/api/v1/reset")
    assert response.status_code == 200
    assert response.json() == {"workers": []}
    drop.assert_awaited()
