# Project: Wellness & Fitness Tracker (personal, self-hosted, single-user)

## What this is
A single-user web app for tracking wearable metrics (steps, calories, sleep), daily chronic-illness symptoms, and training plans, with the goal of surfacing correlations between them (e.g., sleep quality vs. symptom severity).

Full architecture reference: `docs/architecture.md` — read it before starting any new module.

## Stack
- **Framework**: Next.js (App Router), TypeScript. Frontend + API routes in one app — no separate backend service.
- **Database**: SQLite, accessed via better-sqlite3 or Prisma (pick one and stay consistent — see decision log below).
- **No auth system.** Single user. If a login is added at all, it's a simple password gate, not a full auth provider.
- **Styling**: Tailwind CSS.
- **Testing**: Vitest for unit tests, Playwright only if/when end-to-end coverage is worth the setup cost (not needed for v1).

## Data model
See `docs/architecture.md` section 3. No `user_id` columns anywhere — this is intentionally single-tenant for now.

## Conventions
- One feature = one spec file in `/specs/`, implemented against its acceptance criteria before moving to the next.
- Write or update a test alongside any new function/endpoint. Run the test suite before considering a task done.
- Commit after each completed, tested unit of work. Write your own commit message describing what changed and why.
- Keep API routes thin — validation and business logic go in `/lib`, not inline in route handlers.
- Don't introduce a new dependency (ORM, UI library, job queue, etc.) without flagging it first — check against the stack list above.

## Explicitly out of scope for now
- Multi-user support / auth providers
- Job queues (Celery/Redis equivalents) — a simple scheduled function is enough
- Wearable aggregator APIs (Terra/Vital) — CSV import first, direct free-tier device APIs second
- LLM-based coaching features — rules-based logic first

## Decision log
(Update this as choices get made, so future sessions don't re-litigate them.)
- SQLite access library: **better-sqlite3** (decided 2026-07-15, spec 01). Rationale: synchronous API keeps the get-or-create logic simple and easy to unit-test, no ORM codegen/migration tooling to carry, and a `:memory:` database makes tests fast and isolated. It was already one of the two sanctioned options, so this introduces no new/unflagged dependency. Revisit if/when the schema grows complex enough to want Prisma's migrations and typed client.
- Wearable data source for v1: **manual CSV import** (spec 03). Parsed with **PapaParse** (approved new dependency — robust quoted-field/delimiter handling). Data lands in `wearable_metrics`, one row per day per `source`, upserted on `UNIQUE(daily_log_id, source)` so re-imports update in place and a later live-sync spec can add `source='fitbit'` next to `source='csv'`. Fixed known headers (date required; steps/calories_active/calories_resting/sleep_minutes/resting_hr/sleep_stages optional); unknown columns ignored, bad rows reported and skipped.
- Symptom tracking (spec 02, 2026-07-15): symptoms are add/edit/delete-able entries linked to a `conditions` row and the day's `daily_log`; `severity` is an INTEGER 1-10 enforced by a DB CHECK. SQLite foreign keys are enabled per-connection (`PRAGMA foreign_keys = ON`). Starter conditions: Migraine, Rheumatoid Arthritis, Crohn's Disease (seeded idempotently). Per-condition custom fields live in `conditions.tracked_fields` as JSON (not hardcoded per condition).


- Training plans (spec 04, 2026-07-15): templates are **code-defined** in `lib/plan-templates.ts`; starting a plan copies them into `training_plans` + `training_plan_sessions` rows. `scheduled_date = start_date + dayOffset` (pure `addDays` helper in `lib/date.ts`). Sessions track `completed` + `actual_metrics` (duration/distance/rpe/notes, validated in `/lib`). `generated_by`/`template_key` are kept so a later adaptive-plan spec can tell template plans from AI/manual ones. Plan sessions are their own `scheduled_date` timeline, not tied to `daily_logs`.

- Trend dashboard (spec 05, 2026-07-15): read-only analytics at `/trends`. All aggregation + stats live in `lib/trends.ts` (pure, DB-injected, unit-tested); the API route and page stay thin. Charting uses **Recharts** (approved new dependency) in a `"use client"` component with a mount guard for SSR. Symptom severity is aggregated per day as both average and max; correlation is single-day, single-metric **Pearson r** with a zero-variance guard and a small-sample caveat (`MIN_SAMPLE = 7`) — always presented as association, not causation. Wearable series is filtered by `source`; severity optionally by condition.

## Working style
- Ambiguity in a spec is a reason to ask before implementing, not a reason to guess silently — flag it and propose a default.
- Prefer small, verifiable steps over large speculative builds.
