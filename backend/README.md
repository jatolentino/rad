# Simulate API

FastAPI service for the Simulate button. Create must run first so `data/roster.json` exists.

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
# fill MONGODB_URI, OPENAI_API_KEY, LANGFUSE_* 
uvicorn app.main:app --reload --port 8000
```

Optional: in Langfuse Cloud create prompt `parse-requirement` with variables `worker_name`, `requirement_name`, `requirement_type`, `document`. If it is missing, the local fallback prompt is used.

Eval (not on the request path):

```bash
python -m evals.run_eval
```
