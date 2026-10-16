from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorCollection, AsyncIOMotorDatabase

from app.config import settings
from app.models import WorkerRecord, WorkersPayload

_client: AsyncIOMotorClient | None = None

PRE_COLLECTION = "pre_processed"
PROCESSED_COLLECTION = "processed"
DOC_ID = "latest"


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        if not settings.mongodb_uri:
            raise RuntimeError("MONGODB_URI is missing in backend/.env")
        _client = AsyncIOMotorClient(settings.mongodb_uri)
    return _client


def get_db() -> AsyncIOMotorDatabase:
    return get_client()[settings.mongodb_db]


def collection(name: str) -> AsyncIOMotorCollection:
    return get_db()[name]


def serialize_workers(
    workers: list[WorkerRecord],
    *,
    complete: bool = False,
    error: str | None = None,
) -> dict:
    return WorkersPayload(workers=workers, complete=complete, error=error).model_dump()


async def save_payload(name: str, payload: dict) -> None:
    await collection(name).replace_one(
        {"_id": DOC_ID},
        {"_id": DOC_ID, **payload},
        upsert=True,
    )


async def load_payload(name: str) -> dict:
    doc = await collection(name).find_one({"_id": DOC_ID})
    if not doc:
        return {"workers": []}
    doc.pop("_id", None)
    return doc


async def drop_simulate_data() -> None:
    await collection(PRE_COLLECTION).delete_many({})
    await collection(PROCESSED_COLLECTION).delete_many({})
