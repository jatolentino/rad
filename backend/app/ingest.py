import json
import uuid
from pathlib import Path

from app.config import settings
from app.models import KIND_TO_TYPE, RequirementRecord, WorkerRecord


def worker_key(name: str) -> str:
    return name.replace(".", "").replace(" ", "_")


def load_roster() -> dict:
    roster_path = settings.data_dir / "roster.json"
    if not roster_path.is_file():
        raise FileNotFoundError("data/roster.json is missing. Click Create first.")
    return json.loads(roster_path.read_text(encoding="utf-8"))


def build_preprocessed() -> list[WorkerRecord]:
    roster = load_roster()
    workers: list[WorkerRecord] = []
    for item in roster.get("workers", []):
        requirements: dict[str, RequirementRecord] = {}
        for index, requirement in enumerate(item.get("requirements", []), start=1):
            relative = requirement.get("expectedPath") or ""
            requirements[f"req{index}"] = RequirementRecord(
                name=requirement["label"],
                type=KIND_TO_TYPE[requirement["kind"]],
                path=f"data/{relative}".replace("\\", "/"),
                status=None,
            )
        workers.append(
            WorkerRecord(
                id=str(uuid.uuid4()),
                worker=worker_key(item["name"]),
                role=item["roleTitle"],
                requirements=requirements,
            )
        )
    return workers


def absolute_path(relative_api_path: str) -> Path:
    suffix = relative_api_path.removeprefix("data/").removeprefix("data\\")
    return settings.data_dir / suffix
