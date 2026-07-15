# Progress

Tracks build status against `specs/`. Update when a spec is started, and check it off when its acceptance criteria are all met and merged to main.

- [x] 01 — Project scaffold + daily log foundation
- [ ] 02 — Symptom tracking module
- [ ] 03 — CSV import for wearable data
- [ ] 04 — Template-based training plans
- [ ] 05 — Trend dashboard (symptoms x activity)
- [ ] 06 — Live wearable sync (direct API or aggregator)
- [ ] 07 — Rules-based adaptive training plan
- [ ] 08 — LLM-assisted plan rationale / coaching layer

## Notes
- Add a one-line note under a spec once it's done (e.g. date completed, any deviation from the original spec).
- If a spec's scope changes mid-build, update the spec file itself, not just this checklist.
- 01 (2026-07-15): Next.js App Router + Tailwind scaffold, SQLite via better-sqlite3, `daily_logs` table (id/date-unique/created_at), get-or-create in `lib/daily-logs.ts`, `GET /api/daily-logs?date=`, home page confirms today's row, Vitest covers create/idempotency. Chose better-sqlite3 (see CLAUDE.md decision log). Checkbox pending final merge to main.
