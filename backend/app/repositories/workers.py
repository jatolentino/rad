from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorCollection, AsyncIOMotorDatabase

from app.config import settings
from app.models import WorkerRecord, WorkersPayload

_client: AsyncIOMotorClient | None = None
DOC_ID = "latest"


class WorkerRepository:
    """Mongo access for pre-processed and processed Simulate payloads."""

    def __init__(self) -> None:
        self.pre_collection = settings.mongodb_pre_collection
        self.processed_collection = settings.mongodb_processed_collection

    def _client(self) -> AsyncIOMotorClient:
        global _client
        if _client is None:
            if not settings.mongodb_uri:
                raise RuntimeError("MONGODB_URI is missing in backend/.env")
            _client = AsyncIOMotorClient(settings.mongodb_uri)
        return _client

    def _db(self) -> AsyncIOMotorDatabase:
        return self._client()[settings.mongodb_db]

    def _collection(self, name: str) -> AsyncIOMotorCollection:
        return self._db()[name]

    def serialize(
        self,
        workers: list[WorkerRecord],
        *,
        complete: bool = False,
        error: str | None = None,
    ) -> dict:
        return WorkersPayload(
            workers=workers, complete=complete, error=error
        ).model_dump()

    async def save(self, name: str, payload: dict) -> None:
        await self._collection(name).replace_one(
            {"_id": DOC_ID},
            {"_id": DOC_ID, **payload},
            upsert=True,
        )

    async def load(self, name: str) -> dict:
        doc = await self._collection(name).find_one({"_id": DOC_ID})
        if not doc:
            return {"workers": []}
        doc.pop("_id", None)
        return doc

    async def drop_simulate_data(self) -> None:
        await self._collection(self.pre_collection).delete_many({})
        await self._collection(self.processed_collection).delete_many({})


workers_repo = WorkerRepository()
