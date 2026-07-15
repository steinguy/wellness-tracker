# Spec 03: CSV Import for Wearable Data

## Goal
Let the single user import wearable metrics (steps, calories, sleep, resting HR) from a CSV export, storing one row per day tied to the `daily_logs` timeline. This is the low-risk "validate the data model against real-ish data" path from `architecture.md` §4 — no live device APIs yet. It's also the first data that later specs will correlate against symptoms.

## Depends on
- Spec 01 (`daily_logs`, `getOrCreateDailyLog`).
- Spec 02 established the `/lib` + thin-API + Vitest pattern this follows.

## Decisions (confirmed with the user)
- **Input**: file upload of a `.csv` in the UI.
- **Parser**: PapaParse (new dependency, flagged and approved — robust quoted-field / delimiter handling).
- **Columns**: fixed known headers; unknown columns ignored, missing ones stored as NULL.

## Scope
- Schema — add `wearable_metrics` (per `architecture.md` §3):
  - `id`, `daily_log_id` (FK → daily_logs, ON DELETE CASCADE), `source` (TEXT, e.g. `csv`/`fitbit`/`apple`/`manual`),
    `steps`, `calories_active`, `calories_resting`, `sleep_minutes`, `resting_hr` (all nullable INTEGER),
    `sleep_stages` (nullable TEXT / JSON), `synced_at`.
  - `UNIQUE(daily_log_id, source)` so re-importing the same source **upserts** rather than duplicating.
- CSV format — header row with `date` (YYYY-MM-DD, **required**) plus any of:
  `steps`, `calories_active`, `calories_resting`, `sleep_minutes`, `resting_hr`, `sleep_stages`.
  Unknown headers are ignored; absent numeric columns become NULL.
- `/lib` (per `CLAUDE.md` conventions):
  - `lib/wearables.ts`:
    - `parseWearableCsv(text)` → `{ rows, errors }` using PapaParse (`header: true`). Each row is validated: `date` must be a real YYYY-MM-DD; numeric fields must be non-negative integers or blank. Bad rows go to `errors` (with row number + reason), they do **not** abort the import.
    - `importWearableCsv(db, text, source = "csv")` → `{ imported, updated, skipped, errors }`. For each good row: `getOrCreateDailyLog(date)` then upsert into `wearable_metrics` on `(daily_log_id, source)`.
    - `getWearableMetricsByDate(db, date)` → the metric rows for that date.
- API (thin, delegating to `/lib`):
  - `POST /api/wearables/import` — accepts a multipart form upload (`file`, optional `source`), returns the import summary JSON.
  - `GET /api/wearables?date=YYYY-MM-DD` — metrics for that date (defaults to today).
- UI on `/`:
  - An "Import wearable CSV" panel: file picker, optional source label (default `csv`), Import button, and a result summary (`N days imported, M updated, K skipped`, plus any per-row errors).
  - Show today's imported metrics if present.
- Ship a small `sample-data/wearables-sample.csv` to test against.

## Explicitly out of scope for this spec
- Live device APIs / aggregators (spec 06).
- Trend / correlation dashboard overlaying wearables with symptoms (spec 05).
- Manual per-field metric entry/editing in the UI (import is the entry path for now).
- Auth of any kind.

## Acceptance criteria
1. `npm install` picks up PapaParse; `npm run dev` starts with no errors and `/` shows the import panel.
2. Importing a valid CSV creates one `wearable_metrics` row per date, each tied to the correct `daily_log` (creating days that didn't exist yet).
3. Re-importing the **same** CSV (same source) updates the existing rows in place — no duplicate `wearable_metrics` or `daily_logs` rows (upsert on `(daily_log_id, source)`).
4. A malformed row (bad date, negative/non-numeric value) is reported in the summary and skipped, without failing the whole import.
5. Unknown columns are ignored; missing numeric columns are stored as NULL.
6. Vitest covers: parsing valid CSV, column mapping, unknown-column ignore, row-level error reporting, upsert idempotency, and daily_log linkage. `npm test` passes.
7. `CLAUDE.md` decision log (PapaParse + CSV source) and `PROGRESS.md` updated; work committed with a descriptive message.

## Notes for the agent
- Reuse `getOrCreateDailyLog` for date → day resolution; do not re-implement it.
- Keep `source` a first-class column so a later live-sync spec can write `source = "fitbit"` alongside `source = "csv"` for the same day without collision.
- Store `sleep_stages` verbatim as text if present (validate it's JSON if non-empty); full stage modeling is out of scope here.
- PapaParse runs server-side in the API route and in tests (Node env) — import it normally.
