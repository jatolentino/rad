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
