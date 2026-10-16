# Internal HR desk App
## 1. Installation
### 1.1 How to set up your venv and install the packages for the BE

From the repo root:

```bash
cd backend
python -m venv env
source env/Scripts/activate # Windows (Git Bash)
# source env/bin/activate # macOS / Linux
pip install -r requirements.txt
```

### 1.2 How to install the packages for the FE

[Bun](https://bun.sh) is the package manager (`packageManager` in `frontend/package.json`).

```bash
cd frontend
bun install
```

## 2. Configure your `env` variables
### 2.1 For the FE

```bash
cd frontend
cp .env.example .env
```

Set `OPENAI_API_KEY` in `frontend/.env`. The frontend uses it when creating the roster.

`BACKEND_ORIGIN` is optional. It defaults to `http://127.0.0.1:4000`, which matches the backend command below.

### 2.2 For the BE

```bash
cd backend
cp .env.example .env
```

Fill these in `backend/.env`:

- `OPENAI_API_KEY`
- `OPENAI_MODEL` (default `gpt-4o`)
- `MONGODB_URI` (local default `mongodb://127.0.0.1:27017`)
- `MONGODB_DB` (default `clearance`)
- `MONGODB_PRE_COLLECTION` (default `pre_processed`)
- `MONGODB_PROCESSED_COLLECTION` (default `processed`)
- `LANGFUSE_PUBLIC_KEY`
- `LANGFUSE_SECRET_KEY`
- `LANGFUSE_HOST` (default `https://us.cloud.langfuse.com`)

MongoDB needs to be running before you start the backend. Langfuse keys are optional; if the `parse-requirement` prompt is missing, the local fallback prompt is used.

## 3. Run
### How to run the FE

```bash
cd frontend
bun --bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

### How to run the BE

```bash
cd backend
source env/Scripts/activate # Windows (Git Bash)
# source env/bin/activate # macOS / Linux
uvicorn app.main:app --reload --port 4000
```

The API is at [http://127.0.0.1:4000](http://127.0.0.1:4000). Start the backend before using Simulate in the frontend.

## 4. How it works?

The Internal HR desk is a People table at [http://localhost:3000](http://localhost:3000). Product thesis: [PRODUCT.md](PRODUCT.md). System design: [system-design.md](system-design.md).

### 4.1 Creation (`+Create`)

Needs the frontend and `OPENAI_API_KEY` in `frontend/.env`. FastAPI is **not** used.

1. Open the desk. Empty state until you create workers.
2. Click **+Create**. Wait until it finishes (up to ~2 minutes).
3. The app wipes `/data` and writes a synthetic day of files: `roster.json`, certs, emails, and `tests/test.csv` (stand-in for inbox mail and warehouse certs).
4. The table shows **10** workers. Requirement cells stay `—`. No Compliant / Non-compliant yet.

### 4.2 Simulation (`Simulate`)

Needs the backend on port **4000**, MongoDB, and `OPENAI_API_KEY` in `backend/.env`.

1. Click **Simulate** (enabled only after Create).
2. Process 1 loads `/data` into Mongo (`status: null`) and returns. The desk starts polling.
3. Process 2 parses each worker’s three documents in the background (up to 10 workers at a time). Cells fill with **words**: `approved`, `denied`, `positive`, `negative`, or `missing`.
4. When `complete` is true, the Status column is **Compliant** or **Non-compliant**.

**Reset** asks first, then deletes `/data` (keeps `.gitkeep`) and the Mongo simulate collections. The desk goes back to empty.

### 4.3 Evals

Evals are **not** a desk button. They score the parse prompt against labeled gold cases. They do not write `/data` or Mongo.

From `/backend`, with the venv active:

```bash
cd backend
source env/Scripts/activate # Windows (Git Bash)
# source env/bin/activate # macOS / Linux
python -m evals.run_eval
```

Each case prints `PASS` or `FAIL`. The last line is exact-match score (for example `7/8`). Gold file: `backend/evals/parse_gold.json`.
