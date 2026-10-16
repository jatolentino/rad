# Simulate: parse documents, mark clearance

Create wrote messy files under `data/`. Simulate is the second step: read those files, extract an explicit result for each requirement, and show Compliant or Non-compliant on the desk.

Clicking **Simulate** runs two processes in one request. Process 1 does not call an LLM. Process 2 does.

```text
Simulate
  → process 1: roster + paths → MongoDB pre_processed → GET /api/v1/pre-processed-data
      → desk shows requirement names (status null)
  → process 2: parse certs / emails / tests in parallel → MongoDB processed → GET /api/v1/data-processed
      → desk shows result words (positive / negative / approved / not approved / missing), then Compliant or Non-compliant
```

## Process 1 — pre-processed workers

Source of truth is `data/roster.json` from Create. FastAPI maps each worker into MongoDB Atlas collection `pre_processed`. No document is opened. Every `status` is `null`.

```json
{
  "workers": [
    {
      "id": "uuid",
      "worker": "Alice_M",
      "role": "Forklift operator",
      "requirements": {
        "req1": {
          "name": "Forklift cert",
          "type": "certificate",
          "path": "data/certs/forklift/alice-m.md",
          "status": null
        },
        "req2": {
          "name": "Drug test",
          "type": "test",
          "path": "data/tests/test.csv",
          "status": null
        },
        "req3": {
          "name": "I-9",
          "type": "email",
          "path": "data/emails/alice-m-i9.txt",
          "status": null
        }
      }
    }
  ]
}
```

Type mapping from Create: `cert` → `certificate`, `drug_test` → `test`, `email` → `email`. Worker id is a UUID. Worker key is the display name with spaces and dots turned into underscores (`Alice M.` → `Alice_M`).

`GET /api/v1/pre-processed-data` returns this payload. The desk uses it to fill Req1 / Req2 / Req3 **names** only.

## Process 2 — parsed status

For each requirement, FastAPI looks at the file:

- Certificate or email: the path must exist.
- Drug test: `data/tests/test.csv` must exist and contain a row for that worker.

If the file or row is missing, `status` is `missing` and no LLM is called. That is the Create “omit a document” case.

If the file is present, LangChain sends the text to OpenAI **Structured Outputs** (`json_schema`). The model does not invent a free-form answer. The contract is:

```json
{
  "is_there_one": true,
  "result": "positive"
}
```

That LLM `result` is stored on the requirement as `status` (never a boolean):

- Hep B / TB: `positive` or `negative`. Positive means the worker HAS the infection.
- Certificates, I-9, background checks, drug tests: `approved` or `not approved`.
- Missing file or unmatched worker: `missing`.
- “Results were processed” with no outcome: `not approved`.

The desk Status column is **Compliant** only when every requirement actually clears:
- Hep B / TB must be `negative`.
- Everything else must be `approved`.

A Hep B `positive` makes the worker Non-compliant even if the cert and drug test are `approved`.

`GET /api/v1/data-processed` is the same tree as process 1 with `status` as one of those words.

## Parallelism

Ten workers, three requirements, about thirty documents. LangGraph fans out one parse node per requirement and runs up to ten workers at a time (`asyncio` semaphore). Process 1 returns as soon as Mongo has `pre_processed`; process 2 continues in the background and writes `processed`.

## OpenAI tools and evals

Local `.md` / `.txt` / `.csv` files do not need File Search. The useful tool is **Structured Outputs**.

Prompts are stored in **Langfuse Cloud** under `parse-requirement` so they can change without a deploy. If Langfuse has no prompt yet, the backend uses a local fallback. Every parse is traced in Langfuse.

Evals are not run on every Simulate click. `backend/evals/parse_gold.json` is a labeled set of cert / email / CSV snippets. `backend/evals/run_eval.py` scores `is_there_one` and `result` against that gold set (same schema as production). That is the OpenAI eval loop for this parser: labeled examples, structured output, exact-match score.

## Stack

- FastAPI in `/backend`, port 8000.
- LangChain + LangGraph for ingest → persist → fan-out parse → persist.
- MongoDB Atlas collections `pre_processed` and `processed`.
- Langfuse Cloud for prompts and traces.
- Next.js rewrites `/backend/:path*` to `http://127.0.0.1:8000/:path*`.

Env (gitignored `backend/.env`): `MONGODB_URI`, `OPENAI_API_KEY`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_HOST`.

## Frontend

**Simulate** is enabled after Create. Click:

1. `POST /backend/api/v1/simulate`
2. Poll `GET /backend/api/v1/pre-processed-data` until workers exist → show names
3. Poll `GET /backend/api/v1/data-processed` until every `status` is a word → show that word next to each requirement

New **Status** column: **Compliant** if Hep B / TB is `negative` and every other requirement is `approved`, otherwise **Non-compliant**.

Reset still wipes `data/` and also `POST /backend/api/v1/reset` (drops both Mongo collections).

## Endpoints

| Method | Path | Role |
| --- | --- | --- |
| POST | `/api/v1/simulate` | Process 1, then start process 2 |
| GET | `/api/v1/pre-processed-data` | Names, `status: null` |
| GET | `/api/v1/data-processed` | Names, `status`: approved / not approved / positive / negative / missing |
| POST | `/api/v1/reset` | Drop Mongo collections |

## Out of scope

Create, ATS, E-Verify, billing, Docker for Mongo or Langfuse.
