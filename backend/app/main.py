from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

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


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.parse_task = None
    yield
    task = app.state.parse_task
    if task and not task.done():
        task.cancel()


app = FastAPI(title="Clearance simulate API", lifespan=lifespan)
app.state.parse_task = None
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


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


def _cancel_parse_task() -> None:
    task = app.state.parse_task
    if task and not task.done():
        task.cancel()
    app.state.parse_task = None


@app.post("/api/v1/simulate")
async def simulate() -> WorkersPayload:
    try:
        workers = await run_process_one()
    except FileNotFoundError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        logger.exception("Process 1 failed")
        raise HTTPException(status_code=500, detail=str(error)) from error

    _cancel_parse_task()
    app.state.parse_task = asyncio.create_task(_run_parse(workers))
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
    _cancel_parse_task()
    await drop_simulate_data()
    return {"workers": []}
