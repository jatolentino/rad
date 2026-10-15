---
name: fe-clearance-desk
description: >-
  Build a Next.js internal HR clearance desk from a written spec. Use when
  creating or restyling the frontend in /frontend, matching a Mobbin HR screen,
  wiring Create/Reset/Simulate, or generating synthetic files under /data.
---

# Clearance desk frontend

Build only the step the spec names. Do not add Simulate parsing, checkmarks, ATS, or billing unless asked.

## Before writing UI

1. Read `solution.md` and `frontend/AGENTS.md`. This Next.js is not the version in training data. Check `node_modules/next/dist/docs/` for route handlers and App Router before coding.
2. Run `node -v`. Next.js 16 needs Node `>=20.9`. If the shell is older, prepend a newer nvm Node (`v22`) to `PATH` before `bun --bun run dev`.
3. Search Mobbin (`search_screens`, platform `web`) for one HR people directory (Deel People or Gusto People) and one delete dialog (Deputy). Copy color, type, density, and component shape from those screens. Layout alone is not enough: a white page, black rectangle button, and gray table is a failed match.
4. Cite the `mobbin_url` you copied in the reply.

## Screen contract

Route `/` in `frontend/`.

| State | What is on screen |
| --- | --- |
| First load, empty `/data` | No table. No Req1, Req2, Req3 headers. Header + empty state only. |
| After Create | People table: avatar, name, role, and three blank requirement cells (`—`). No labels, no ✅ / ❌. |
| Reset | Visible only when workers exist. Confirm in a modal before deleting. |

Buttons, left to right when data exists: **Reset** (outline), **Simulate** (outline, disabled), **+ Create** (solid dark pill).

## Data

- Disk root is `path.resolve(process.cwd(), "..", "data")` when the app cwd is `frontend/`.
- `POST /api/create` calls OpenAI (`gpt-4o`, JSON). Roles are a fixed catalog in `frontend/lib/roles.ts`. The model invents names and document text, and omits at least three required files. `roster.json` still lists every requirement.
- Certs: `data/certs/<category>/<slug>.md`. Drug tests: `data/tests/test.csv`. Emails: `data/emails/<slug>-<suffix>.txt`.
- `GET /api/roster` returns `{ workers: [] }` when `roster.json` is missing.
- `POST /api/reset` deletes generated files and leaves `data/.gitkeep`. Create must not leave folders behind after Reset.
- Key lives in `frontend/.env` or `frontend/.env.local`. Never commit it. If the key is missing, return a clear 500 and leave the table empty.

## Visual rules (Deel People)

- Page background `#f6f3fb`. Top bar is a short lavender gradient (`#efe7fb` → page), not a heavy sidebar.
- Font: Inter. Title is a large “People” heading, not a small uppercase label.
- Primary action is a near-black pill. Secondary actions are white pills with a light border.
- Each row: colored initials avatar, name in purple (`#5b4dc9`), role in muted slate under the name.
- Table sits on a white rounded card. Header row is quiet gray, not a filled gray band.
- Delete dialog: dim overlay, title “Permanently delete”, amber warning strip, text **Cancel**, red **Permanently delete**.

## Do not

- Render requirement names before Simulate.
- Enable Simulate.
- Infer clearance from the filesystem in the UI.
- Restyle with generic zinc/Tailwind defaults after a Mobbin search.
- Start a second `next dev` if port 3000 is taken. Kill the listed PID, then start one server.

## Check

1. Fresh `bun --bun run dev`: `/` has no Req columns.
2. Create returns 10 workers and files under `data/`, with at least three required files absent.
3. Requirement cells stay blank.
4. Reset asks, then `/` and `/data` are empty again except `.gitkeep`.
