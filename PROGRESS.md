# Progress

Tracks build status against `specs/`. Update when a spec is started, and check it off when its acceptance criteria are all met and merged to main.

- [x] 01 — Project scaffold + daily log foundation
- [x] 02 — Symptom tracking module
- [x] 03 — CSV import for wearable data
- [x] 04 — Template-based training plans
- [x] 05 — Trend dashboard (symptoms x activity)
- [ ] 06 — Live wearable sync (direct API or aggregator)
- [ ] 07 — Rules-based adaptive training plan
- [ ] 08 — LLM-assisted plan rationale / coaching layer

## Notes
- Add a one-line note under a spec once it's done (e.g. date completed, any deviation from the original spec).
- If a spec's scope changes mid-build, update the spec file itself, not just this checklist.
- 01 (2026-07-15): Next.js App Router + Tailwind scaffold, SQLite via better-sqlite3, `daily_logs` table (id/date-unique/created_at), get-or-create in `lib/daily-logs.ts`, `GET /api/daily-logs?date=`, home page confirms today's row, Vitest covers create/idempotency. Chose better-sqlite3 (see CLAUDE.md decision log). Checkbox pending final merge to main.
- 02 (2026-07-15): `conditions` + `symptom_entries` tables (FKs on, severity 1-10 CHECK, ON DELETE CASCADE from daily_logs). Seeded Migraine / Rheumatoid Arthritis / Crohn's Disease (idempotent). `lib/conditions.ts` + `lib/symptoms.ts` (add/list/update/delete). API: `/api/conditions`, `/api/symptoms` (GET/POST), `/api/symptoms/[id]` (PATCH/DELETE). `/` has a log form + today's entries with inline edit and delete. Vitest covers day-linkage, same-day reuse, severity bounds (insert+update), FK rejection, seeding, edit, delete. Added edit/delete beyond the original v1 sketch per request. Checkbox pending final merge to main.
- 03 (2026-07-15): `wearable_metrics` table (FK to daily_logs, ON DELETE CASCADE, UNIQUE(daily_log_id, source)). CSV import via PapaParse (new dep, approved): `lib/wearables.ts` parse+validate (fixed headers, unknown columns ignored, blanks→NULL, bad rows reported not fatal) and upsert per (day, source). API: `POST /api/wearables/import` (file upload), `GET /api/wearables?date=`. `/` has an import panel + today's metrics. `sample-data/wearables-sample.csv` included. Vitest covers parse/mapping/errors/upsert-idempotency/multi-source. Checkbox pending final merge to main.
- 04 (2026-07-15): `training_plans` + `training_plan_sessions` (FK cascade, completed CHECK 0/1). Code-defined templates in `lib/plan-templates.ts` (Couch to 5K / Beginner Strength 3×/week / 5K to 10K). `lib/plans.ts` generates a dated schedule (scheduled_date = start + dayOffset via new `addDays` helper), complete/uncomplete with validated actuals (duration/distance/rpe 1-10/notes). API: `/api/plan-templates`, `/api/plans` (+`[id]`), `/api/plan-sessions/[id]`. New `/plans` page (linked from `/`) to start plans and tick off sessions with actuals. Vitest covers generation counts/dates, completion+actuals validation, cascade, addDays. Chose done+actuals tracking. Checkbox pending final merge to main.
- 05 (2026-07-15): Read-only trends dashboard at `/trends` (linked from `/`). `lib/trends.ts` builds a per-day series (severity avg+max from symptom_entries, wearable steps/sleep/resting_hr merged by date), Pearson `pearson`/`correlate` with zero-variance + small-sample guards, and `interpretR` plain-language read. `GET /api/trends?start&end&conditionId&source`. Recharts (approved new dep) ComposedChart overlays severity (avg+max, left axis) with a selectable wearable metric (right axis); correlation callouts vs avg & max with "association, not causation" caveat. Vitest covers aggregation/filter/merge + Pearson correctness/null cases. Checkbox pending final merge to main.
