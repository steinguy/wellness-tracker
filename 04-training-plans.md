# Spec 04: Template-Based Training Plans

## Goal
Let the single user start a training plan from a pre-built template, which generates a dated schedule of workout sessions. Each session can be marked done and have its actual metrics recorded against the template's target. This is the straightforward CRUD-plus-scheduling tier from `architecture.md` §6 — **no AI, no symptom/wearable-driven adaptation** (that's specs 07–08).

## Depends on
- Spec 01 (`daily_logs`, date helpers) and the established `/lib` + thin-API + Vitest pattern.

## Decisions (confirmed with the user)
- **Templates are code-defined** — constants/builders in `lib/plan-templates.ts`. Starting a plan copies them into DB rows. Authoring templates in-app is a possible later spec.
- **Starter templates**: Couch to 5K, Beginner Strength 3×/week, 5K to 10K.
- **Tracking**: done **+ actuals** — each session has a `completed` toggle and optional recorded actual metrics.

## Scope
- Schema (per `architecture.md` §3):
  - `training_plans`: `id`, `name`, `goal`, `start_date`, `generated_by` (`template`/`ai`/`manual`, default `template`), `template_key` (which template it came from), `created_at`.
  - `training_plan_sessions`: `id`, `training_plan_id` (FK → training_plans, ON DELETE CASCADE), `scheduled_date`, `workout_type`, `target_metrics` (JSON text), `completed` (0/1, default 0), `actual_metrics` (JSON text, nullable), `completed_at` (nullable).
- Code-defined templates — `lib/plan-templates.ts`:
  - A `PlanTemplate` = `{ key, name, goal, durationWeeks, sessions: TemplateSession[] }`.
  - A `TemplateSession` = `{ dayOffset, workoutType, targetMetrics }`, where `dayOffset` is days from the plan's `start_date`.
  - Ship the three templates above, built with small helper functions (they're code, so a builder that emits e.g. C25K's 27 sessions is fine).
- Business logic — `lib/plans.ts`:
  - `createPlanFromTemplate(db, templateKey, startDate)` — validate template + date, insert the plan, generate `training_plan_sessions` with `scheduled_date = startDate + dayOffset`. Returns the plan with its sessions.
  - `listPlans(db)`, `getPlan(db, id)` (plan + sessions ordered by date), `deletePlan(db, id)`.
  - `completeSession(db, sessionId, actuals?)` — set `completed = 1`, store validated `actual_metrics`, stamp `completed_at`. `uncompleteSession(db, sessionId)` — revert.
  - Actuals are a small generic shape usable across template types: optional `duration_min`, `distance` + `distance_unit` (`km` or `mi`, default `km`), `rpe` (1–10), `notes`. Numeric fields must be non-negative; `rpe` within 1–10. Distance is stored canonically as `distance_km` (miles converted at `1 mi = 1.609344 km`) with the entered `distance_unit` remembered for display, so later correlation always has consistent km while the UI can echo the user's preferred unit.
- API (thin, delegating to `/lib`):
  - `GET /api/plan-templates` — list available templates (key, name, goal, duration, session count).
  - `GET /api/plans` — list plans. `POST /api/plans` `{ templateKey, startDate }` — create. 
  - `GET /api/plans/[id]` — plan + sessions. `DELETE /api/plans/[id]` — delete.
  - `PATCH /api/plan-sessions/[id]` `{ completed, actuals? }` — mark done/undone + actuals.
- UI — a dedicated `/plans` page (linked from `/`):
  - "Start a plan": pick a template + start date → generates the schedule.
  - Plan list; selecting a plan shows its sessions (date, workout type, target). Each session has a Done toggle and, when marking done, fields for actual duration / distance / RPE / notes.

## Explicitly out of scope for this spec
- Adaptive/generated plans driven by symptom or wearable trends (specs 07–08).
- In-app authoring/editing of templates (code-defined for now).
- Editing a session's scheduled date or target (delete the plan and regenerate if needed).
- Auth of any kind.

## Acceptance criteria
1. `npm run dev` starts with no errors; `/plans` lists templates and existing plans.
2. Starting a plan from a template creates one `training_plans` row and the correct number of `training_plan_sessions`, with `scheduled_date` = start date + each session's day offset (first session on the start date).
3. Marking a session done sets `completed = 1`, records any provided actuals as `actual_metrics` JSON, and stamps `completed_at`; un-marking reverts all three.
4. Invalid input is rejected: unknown template key, malformed start date, `rpe` outside 1–10, negative numeric actuals.
5. Deleting a plan removes its sessions (cascade); no orphan sessions remain.
6. Vitest covers: session generation count + date offsets, complete/uncomplete with actuals, actuals validation, and cascade delete. `npm test` passes.
7. `PROGRESS.md` / `CLAUDE.md` updated; work committed with a descriptive message.

## Notes for the agent
- Compute `scheduled_date` with a pure `addDays(iso, n)` helper (add to `lib/date.ts`) so it's unit-testable without a DB.
- `target_metrics` and `actual_metrics` are opaque JSON text at the DB layer; validate `actual_metrics` shape in `/lib` before writing.
- Training-plan sessions are their own timeline (`scheduled_date`), independent of `daily_logs`; they don't need a `daily_log_id` for this spec. A later correlation spec can join them by date if useful.
- Keep `generated_by` and `template_key` populated so a future adaptive-plan spec can distinguish template-generated plans from AI/manual ones.
