from __future__ import annotations

import asyncio
import logging
from copy import deepcopy
from typing import Annotated, Any, TypedDict

import operator
from langgraph.graph import END, START, StateGraph

from app.db import PRE_COLLECTION, PROCESSED_COLLECTION, save_payload, serialize_workers
from app.ingest import build_preprocessed
from app.models import WorkerRecord
from app.parse import parse_requirement, status_label

logger = logging.getLogger(__name__)
WORKER_CONCURRENCY = 10


class GraphState(TypedDict, total=False):
    workers: list[dict[str, Any]]
    processed: list[dict[str, Any]]
    errors: Annotated[list[str], operator.add]


async def ingest_node(_state: GraphState) -> dict:
    workers = [item.model_dump() for item in build_preprocessed()]
    return {"workers": workers}


async def persist_pre_node(state: GraphState) -> dict:
    records = [WorkerRecord.model_validate(item) for item in state["workers"]]
    await save_payload(PRE_COLLECTION, serialize_workers(records, complete=False))
    await save_payload(
        PROCESSED_COLLECTION,
        serialize_workers(records, complete=False),
    )
    return {}


async def parse_all_node(state: GraphState) -> dict:
    workers = [WorkerRecord.model_validate(item) for item in state["workers"]]
    processed = [item.model_dump() for item in workers]
    semaphore = asyncio.Semaphore(WORKER_CONCURRENCY)
    lock = asyncio.Lock()

    async def persist_progress() -> None:
        records = [WorkerRecord.model_validate(item) for item in processed]
        await save_payload(
            PROCESSED_COLLECTION,
            serialize_workers(records, complete=False),
        )

    async def parse_worker(index: int, worker: WorkerRecord) -> dict[str, Any]:
        async with semaphore:
            updated = worker.model_copy(deep=True)
            for key, requirement in updated.requirements.items():
                try:
                    verdict = await parse_requirement(updated.worker, requirement)
                    updated.requirements[key].status = status_label(
                        verdict, requirement
                    )
                except Exception:
                    logger.exception(
                        "Parse failed for %s / %s",
                        updated.worker,
                        requirement.name,
                    )
                    updated.requirements[key].status = "missing"
            dumped = updated.model_dump()
            async with lock:
                processed[index] = dumped
                await persist_progress()
            return dumped

    await asyncio.gather(
        *(parse_worker(index, worker) for index, worker in enumerate(workers))
    )
    return {"processed": list(processed)}


async def persist_processed_node(state: GraphState) -> dict:
    records = [WorkerRecord.model_validate(item) for item in state["processed"]]
    await save_payload(
        PROCESSED_COLLECTION,
        serialize_workers(records, complete=True),
    )
    return {}


def build_process_one():
    graph = StateGraph(GraphState)
    graph.add_node("ingest", ingest_node)
    graph.add_node("persist_pre", persist_pre_node)
    graph.add_edge(START, "ingest")
    graph.add_edge("ingest", "persist_pre")
    graph.add_edge("persist_pre", END)
    return graph.compile()


def build_process_two():
    graph = StateGraph(GraphState)
    graph.add_node("parse_all", parse_all_node)
    graph.add_node("persist_processed", persist_processed_node)
    graph.add_edge(START, "parse_all")
    graph.add_edge("parse_all", "persist_processed")
    graph.add_edge("persist_processed", END)
    return graph.compile()


process_one_graph = build_process_one()
process_two_graph = build_process_two()


async def run_process_one() -> list[WorkerRecord]:
    state = await process_one_graph.ainvoke({"workers": [], "processed": [], "errors": []})
    return [WorkerRecord.model_validate(item) for item in state["workers"]]


async def run_process_two(workers: list[WorkerRecord]) -> None:
    await process_two_graph.ainvoke(
        {
            "workers": deepcopy([item.model_dump() for item in workers]),
            "processed": [],
            "errors": [],
        },
    )
