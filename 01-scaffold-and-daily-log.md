# Spec 01: Project Scaffold + Daily Log Foundation

## Goal
Stand up the Next.js project with SQLite wired in, and implement the `daily_logs` table plus a minimal UI to confirm the whole stack works end to end. This is the foundation every other module depends on — no feature logic yet, just plumbing proven to work.

## Scope
- Initialize Next.js (App Router, TypeScript, Tailwind).
- Set up SQLite with a chosen access library (decide: better-sqlite3 vs Prisma; record the choice in `CLAUDE.md`'s decision log).
- Create the `daily_logs` table: `id`, `date` (unique), `created_at`.
- One API route: `GET /api/daily-logs?date=YYYY-MM-DD` — returns the log for that date, creating it if it doesn't exist.
- One page: `/` — shows today's date and confirms a daily_log row exists for it (simple text confirmation is fine, no design polish needed yet).

## Explicitly out of scope for this spec
- Symptom entries, wearable metrics, training plans (later specs)
- Auth of any kind
- Styling beyond "functional and readable"

## Acceptance criteria
1. `npm run dev` starts the app with no errors.
2. Visiting `/` shows today's date and confirms a corresponding row exists in `daily_logs`.
3. Restarting the dev server does not create duplicate rows for the same date (unique constraint enforced).
4. A test exists (Vitest) that calls the daily-log creation/fetch logic directly and asserts: (a) first call creates a row, (b) second call for the same date returns the same row rather than creating a new one.
5. `CLAUDE.md` decision log is updated with the SQLite library choice.
6. Work is committed with a message describing what was built.

## Notes for the agent
- Keep the daily-log get-or-create logic in `/lib/daily-logs.ts` (or equivalent), not inline in the route handler, per the project conventions in `CLAUDE.md`.
- If Prisma is chosen, keep the schema file minimal — just `daily_logs` for now; later specs will extend it.
