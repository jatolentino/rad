from app.models import WorkerRecord
from app.repositories.workers import workers_repo

PRE_COLLECTION = workers_repo.pre_collection
PROCESSED_COLLECTION = workers_repo.processed_collection


def serialize_workers(
    workers: list[WorkerRecord],
    *,
    complete: bool = False,
    error: str | None = None,
) -> dict:
    return workers_repo.serialize(workers, complete=complete, error=error)


async def save_payload(name: str, payload: dict) -> None:
    await workers_repo.save(name, payload)


async def load_payload(name: str) -> dict:
    return await workers_repo.load(name)


async def drop_simulate_data() -> None:
    await workers_repo.drop_simulate_data()
