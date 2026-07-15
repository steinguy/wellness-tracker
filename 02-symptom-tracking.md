# Spec 02: Symptom Tracking Module

## Goal
Let the single user log daily chronic-illness symptoms against the `daily_logs` timeline built in spec 01. Each symptom entry belongs to a condition (e.g. migraine, IBS) and a day, so it can later be correlated with wearable/activity data. This spec is fully manual entry — no wearable data, no trends dashboard yet.

## Depends on
- Spec 01 (`daily_logs`, `getOrCreateDailyLog`, better-sqlite3 setup).

## Scope
- Extend the schema with two tables (see `architecture.md` §3):
  - `conditions`: `id`, `name` (unique), `tracked_fields` (JSON text), `created_at`.
  - `symptom_entries`: `id`, `daily_log_id` (FK → daily_logs), `condition_id` (FK → conditions), `severity` (INTEGER 1–10), `notes` (nullable text), `logged_at`.
- Enable SQLite foreign keys (`PRAGMA foreign_keys = ON`) in the DB setup.
- Seed a small set of starter condition templates — **Migraine, Rheumatoid Arthritis, Crohn's Disease** — idempotently on startup. Users can add more; hardcoding a schema per condition is explicitly avoided (`architecture.md` §3) — `tracked_fields` holds the customizable field definitions as JSON.
- Business logic in `/lib` (per `CLAUDE.md` conventions):
  - `lib/conditions.ts`: `listConditions`, `createCondition`, `seedDefaultConditions` (idempotent).
  - `lib/symptoms.ts`: `addSymptomEntry({ date, conditionId, severity, notes })` — gets-or-creates the day's `daily_log`, validates inputs, inserts; `listSymptomEntriesByDate(date)` — returns entries (with condition name) for that date; `updateSymptomEntry(id, { conditionId?, severity?, notes? })` — edits an existing entry with the same validation; `deleteSymptomEntry(id)` — removes an entry.
- API routes (thin, delegating to `/lib`):
  - `GET /api/conditions` — list conditions (seeding defaults if empty). `POST /api/conditions` — create a condition (`{ name, tracked_fields? }`).
  - `GET /api/symptoms?date=YYYY-MM-DD` — list entries for that date (defaults to today). `POST /api/symptoms` — create an entry (`{ date?, conditionId, severity, notes? }`).
  - `PATCH /api/symptoms/[id]` — edit an entry (`{ conditionId?, severity?, notes? }`). `DELETE /api/symptoms/[id]` — delete an entry.
- UI on `/`:
  - A form to log a symptom for today: pick a condition, set severity (1–10 slider), optional notes.
  - A list of today's logged entries (condition name, severity, notes, time), each with **Edit** (inline: change condition/severity/notes and save) and **Delete** controls.
  - Functional and readable; no design polish required.

## Explicitly out of scope for this spec
- Wearable metrics and CSV import (specs 03).
- Trend / correlation views overlaying symptoms with activity (spec 05).
- PDF/CSV symptom export (later).
- Auth of any kind.

## Acceptance criteria
1. `npm run dev` starts with no errors; `/` shows the symptom-log form and today's entries.
2. Submitting the form adds an entry that appears in today's list without a full-page reload feeling broken (a router refresh is fine).
3. A symptom entry is always tied to the correct `daily_log` for its date; logging two symptoms on the same day does **not** create duplicate `daily_logs` rows.
4. `severity` outside 1–10 is rejected by both the validation layer and a DB `CHECK` constraint (on insert **and** update); an entry referencing a non-existent condition is rejected.
5. `seedDefaultConditions` is idempotent — running it repeatedly (e.g. server restarts) does not create duplicate condition rows.
6. An entry can be edited in place (condition / severity / notes) and deleted from the list; the change is reflected immediately in today's entries.
7. Vitest tests cover: entry creation links to the right day, same-day reuse of one `daily_log`, severity bounds rejection (insert and update), idempotent seeding, editing an entry, and deleting an entry. `npm test` passes.
8. `CLAUDE.md` decision log / `PROGRESS.md` updated; work committed with a descriptive message.

## Notes for the agent
- Keep `getOrCreateDailyLog` from spec 01 as the single entry point for resolving a date → `daily_log`; do not re-implement day resolution in the symptom layer.
- `tracked_fields` is JSON stored as text. For v1, seed it with a minimal shape (e.g. `{"fields": []}` or a couple of suggested trigger tags) — the point is that the column exists and is per-condition, not that the UI fully renders custom fields yet.
- Foreign keys must be enabled per-connection in SQLite (`PRAGMA foreign_keys = ON`), including the test connections, or the FK/rejection tests won't behave.
- The severity slider form is a client component; the entries list can render server-side from `/lib`.
