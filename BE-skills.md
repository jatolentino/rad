---
name: be-clearance-simulate
description: >-
  Work on the FastAPI Simulate backend in /backend. Use when changing ingest,
  LangGraph, parse, Mongo, Langfuse, or clearance labels.
---

# Clearance simulate backend

Do not parse documents in the frontend. Create lives in Next.js. This API only ingests, parses, and stores status words.

## Before changing code

1. Read `system-design.md` for the two-process flow.
2. Keep FastAPI on **port 4000**. The desk proxies here. An old process on 8000 will show stale boolean `status` values.
3. Do not put parsing logic in `app/main.py`. HTTP adapter only.

## Ports and graphs

| Piece | Rule |
| --- | --- |
| Process 1 | Ingest `/data` → persist `pre_processed` (and a first `processed` snapshot). Return immediately. |
| Process 2 | Background task. Parse with a semaphore of 10 workers. Persist after each worker. Set `complete: true` at the end. |
| Graphs | Two compiled graphs in `app/graph.py`. Keep them. |

Mongo names come from env: `MONGODB_PRE_COLLECTION`, `MONGODB_PROCESSED_COLLECTION`. One doc `_id: latest` per collection.

## Status labels

`RequirementRecord.status` is a **word**, never a boolean:

`approved` | `denied` | `positive` | `negative` | `missing`

Structured output schema: `ParseVerdict` (`is_there_one`, `result`). Map through `status_label` in `app/services/clearance.py`.

Clearance:

- Hep B / TB (infection screens): pass only if `negative`. `positive` fails even if other reqs pass.
- Certificates, I-9, background, drug tests: pass only if `approved`.

## LangChain and Langfuse

- LLM: `ChatOpenAI.with_structured_output(ParseVerdict)`.
- Prompt name in Langfuse: **`parse-requirement`**.
- Facade: `langfuse_client()` / `langfuse_handler()` in `app/services/langfuse.py`. Parse must not hardcode host or keys.
- Strategy: `build_prompt` in `app/services/prompts.py` loads Langfuse, then appends the local fallback. If keys or the prompt fail, use the local prompt only.

Env (no secrets in git):

- `OPENAI_API_KEY`, `OPENAI_MODEL` (default `gpt-4o`)
- `MONGODB_URI`, `MONGODB_DB`
- `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`
- `LANGFUSE_HOST` — a URL, e.g. `https://us.cloud.langfuse.com` (US) or `https://cloud.langfuse.com` (EU). Not the word `US`.

## Layers

- Repository: all Mongo through `app/repositories/workers.py` (`app/db.py` is a thin wrapper).
- Do not add extra frameworks. New mixed logic goes in `app/services/` if a file would otherwise mix HTTP, Mongo, and LLM.

## Evals

Run separately from the desk:

```bash
cd backend
python -m evals.run_eval
```

Gold cases: `backend/evals/parse_gold.json`. Do not call this from FastAPI routes.

## Do not

- Store `true` / `false` on `status`.
- Parse in Next.js.
- Block the simulate HTTP response on process 2.
- Raise worker concurrency without checking OpenAI rate limits.
