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
- Wearable data source for v1: _not yet decided (manual CSV planned)_

## Working style
- Ambiguity in a spec is a reason to ask before implementing, not a reason to guess silently — flag it and propose a default.
- Prefer small, verifiable steps over large speculative builds.
