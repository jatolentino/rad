---
name: fe-clearance-desk
description: >-
  Build a Next.js internal HR clearance desk from a written spec. Use when
  creating or restyling the frontend in /frontend, matching a Mobbin HR screen,
  wiring Create / Simulate / Reset, or generating synthetic files under /data.
---

# Clearance desk frontend

Build only the step the spec names. Do not add Simulate parsing, ATS, or billing unless asked. Parse stays on FastAPI.

## Before writing UI

1. Read `system-design.md`, `PRODUCT.md`, and `frontend/AGENTS.md`. This Next.js is not the version in training data. Check `node_modules/next/dist/docs/` for route handlers and App Router before coding.
2. Run `node -v`. Next.js 16 needs Node `>=20.9`. If the shell is older, prepend a newer nvm Node (`v22`) to `PATH` before `bun --bun run dev`.
3. Search Mobbin (`search_screens`, platform `web`) for one HR people directory (Deel People or Gusto People) and one delete dialog (Deputy). Copy color, type, density, and component shape from those screens. Layout alone is not enough: a white page, black rectangle button, and gray table is a failed match.
4. Cite the `mobbin_url` you copied in the reply.

## Screen contract

Route `/` in `frontend/`. Desk is a presenter (`app/desk.tsx`). State lives in the Redux desk slice.

| State | What is on screen |
| --- | --- |
| First load, empty `/data` | No table. No Req1, Req2, Req3 headers. Header + empty state only. |
| After Create | People table: avatar, name, role, three requirement cells (`—` until Simulate). Status column `—`. |
| After Simulate | Each req cell shows the requirement name plus a **word**: `approved`, `denied`, `positive`, `negative`, or `missing`. Status column: **Compliant** or **Non-compliant**. No checkmarks. |
| Reset | Always visible. Disabled (lighter fill, lighter text) when there are no workers. Confirm in a modal before deleting. |

Buttons, left to right: **+ Create** (solid dark pill), **Simulate** (blue), **Reset** (red).

- Empty desk: Simulate and Reset stay visible but disabled — lighter blue / red fill, lighter gray text. Create stays enabled.
- After Create: Simulate is medium blue (`bg-blue-400`) with white text; hover darker blue. Reset is medium red (`bg-red-400`) with white text; hover darker red.
- Reset always asks in the modal (title “Permanently delete”) before deleting.

## Create vs Simulate

- Create is a Next.js BFF route (`POST /api/create`). OpenAI JSON, then **code writes six guaranteed passing workers** (valid certs, negative Hep B / TB, negative drug rows). Do not rely on the model alone for those six.
- Simulate is **not** parsed in the browser. Thunks call `/backend/api/v1/simulate` then poll `/backend/api/v1/data-processed`. The Next rewrite / catch-all proxy uses `BACKEND_ORIGIN` (default `http://127.0.0.1:4000`).
- Compliant: infection screens (Hep B / TB) need `negative`; every other req needs `approved`. Helpers live in `frontend/lib/clearance.ts`, not in the table JSX.
- Fetch URLs live in `frontend/lib/api/desk.ts`. Redux thunks only dispatch.

## Data

- Disk root is `path.resolve(process.cwd(), "..", "data")` when the app cwd is `frontend/`.
- `POST /api/create` uses OpenAI (`gpt-4o`, JSON). Roles are a fixed catalog in `frontend/lib/roles.ts`.
- Certs: `data/certs/<category>/<slug>.md`. Drug tests: `data/tests/test.csv`. Emails: `data/emails/<slug>-<suffix>.txt`.
- `GET /api/roster` returns `{ workers: [] }` when `roster.json` is missing.
- `POST /api/reset` deletes generated files and leaves `data/.gitkeep`. Create must not leave folders behind after Reset.
- Key lives in `frontend/.env` or `frontend/.env.local`. Never commit it. If the key is missing, return a clear 500 and leave the table empty.

## Visual rules (Deel People)

- Page background `#f6f3fb`. Top bar is a short lavender gradient (`#efe7fb` → page), not a heavy sidebar.
- Font: Inter. Title is a large “People” heading, not a small uppercase label.
- Primary action is a near-black pill. Simulate is blue. Reset is red. Do not use a heavy black stroke on disabled buttons; use lighter fill and lighter text instead.
- Each row: colored initials avatar, name in purple (`#5b4dc9`), role in muted slate under the name.
- Table sits on a white rounded card. Header row is quiet gray, not a filled gray band.
- Delete dialog: dim overlay, title “Permanently delete”, amber warning strip, text **Cancel**, red **Permanently delete**.

## Do not

- Parse documents in the frontend.
- Show ✅ / ❌ in requirement cells. Use the status words from Mongo.
- Infer clearance from the filesystem in the UI.
- Put `fetch` URLs inside `desk.tsx`.
- Restyle with generic zinc/Tailwind defaults after a Mobbin search.
- Start a second `next dev` if port 3000 is taken. Kill the listed PID, then start one server.
- Point Simulate at port 8000.

## Check

1. Fresh `bun --bun run dev`: `/` has no Req columns until Create.
2. Create returns 10 workers and files under `data/`. Six of those workers have complete passing files.
3. Requirement cells stay blank until Simulate finishes polling.
4. After Simulate, cells show words; Status is Compliant or Non-compliant.
5. Reset asks, then `/` and `/data` are empty again except `.gitkeep`.
