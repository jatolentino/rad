from __future__ import annotations

import asyncio
import logging

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.db import (
    PRE_COLLECTION,
    PROCESSED_COLLECTION,
    drop_simulate_data,
    load_payload,
    save_payload,
    serialize_workers,
)
from app.graph import run_process_one, run_process_two
from app.models import WorkerRecord, WorkersPayload

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Clearance simulate API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_parse_task: asyncio.Task | None = None


def workers_from_state(state: dict) -> list[WorkerRecord]:
    return [WorkerRecord.model_validate(item) for item in state.get("workers", [])]


async def _run_parse(workers: list[WorkerRecord]) -> None:
    try:
        await run_process_two(workers)
    except Exception as error:
        logger.exception("Process 2 parse failed")
        await save_payload(
            PROCESSED_COLLECTION,
            serialize_workers(workers, complete=False, error=str(error)),
        )


@app.post("/api/v1/simulate")
async def simulate() -> WorkersPayload:
    global _parse_task
    try:
        workers = await run_process_one()
    except FileNotFoundError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        logger.exception("Process 1 failed")
        raise HTTPException(status_code=500, detail=str(error)) from error

    if _parse_task and not _parse_task.done():
        _parse_task.cancel()
    _parse_task = asyncio.create_task(_run_parse(workers))
    return WorkersPayload(workers=workers)


@app.get("/api/v1/pre-processed-data")
async def pre_processed() -> dict:
    try:
        return await load_payload(PRE_COLLECTION)
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error


@app.get("/api/v1/data-processed")
async def data_processed() -> dict:
    try:
        return await load_payload(PROCESSED_COLLECTION)
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error


@app.post("/api/v1/reset")
async def reset() -> dict:
    global _parse_task
    if _parse_task and not _parse_task.done():
        _parse_task.cancel()
        _parse_task = None
    await drop_simulate_data()
    return {"workers": []}
