# Wellness & Fitness Tracker — Architecture Plan
### (Personal / self-hosted, single-user)

## 1. System Overview

Three modules sharing one user account and one timeline:

1. **Wearable Data Ingestion** — steps, calories, sleep
2. **Chronic Symptom Tracking** — daily logs, severity, triggers
3. **Training Plans** — templates + generated plans, tied to the same activity data

Everything hangs off a single `daily_log` concept per user per date, so symptoms, workouts, and wearable metrics can all be correlated later ("did sleep quality predict flare-ups?"). That correlation is the actual differentiator of this app — design the data model for it from day one.

## 2. High-Level Architecture (self-hosted, single-user)

```
[Next.js app — frontend + API routes, one deployable unit]
        |
        v
[SQLite file (local disk)]
        |
[Scheduled job (cron / node-cron) for wearable sync]
```

- **Framework**: Next.js (React frontend + API routes in one app). One deployable thing, no separate frontend/backend to run or deploy.
- **Database**: SQLite. Single file, no server process to manage, trivial backups (copy the file). Plenty for one user's data volume.
- **No auth service needed**: single-user, so a simple password gate (or just running it on a private network/VPN) is enough — skip Auth0/Clerk/session infrastructure entirely for now.
- **Background jobs**: a scheduled task (node-cron, or even a manual "sync now" button for v1) pulls wearable data periodically. No need for a full job queue (Celery/Redis) at this scale.
- **Hosting**: your own hardware, a Raspberry Pi, or a ~$5-6/month VPS if you'd rather not manage uptime. Either way, cost is ~$0 if self-hosted on hardware you already have.

## 3. Core Data Model

```
daily_logs
  id, date (unique)

wearable_metrics
  id, daily_log_id, source (fitbit/apple/manual/csv),
  steps, calories_active, calories_resting,
  sleep_minutes, sleep_stages(json), resting_hr, synced_at

symptom_entries
  id, daily_log_id, condition_id, severity (1-10),
  notes, logged_at

conditions
  id, name, tracked_fields(json)  -- custom symptoms/scales per condition

training_plans
  id, name, goal, start_date, generated_by (template/ai/manual)

training_plan_sessions
  id, training_plan_id, scheduled_date, workout_type,
  target_metrics(json), completed, actual_metrics(json)
```

No `user_id` columns for now — single-user means every table is implicitly "yours." If you ever want to open this to other people later, adding a `users` table and a `user_id` foreign key back onto `daily_logs` is a contained migration, not a rewrite.

The `tracked_fields` json on `conditions` matters: chronic illness symptom sets vary a lot person to person (pain scale vs fatigue scale vs GI symptoms vs joint-specific). Don't hardcode a schema — let users define fields per condition, or ship a few pre-built condition templates (e.g., "migraine," "IBS," "fibromyalgia") they can start from and customize.

## 4. Wearable Integration — Your Options

Since you're not locked in yet, here's the real tradeoff:

| Approach | Effort | Coverage | Notes |
|---|---|---|---|
| **Manual CSV upload** | Low | Any device that exports data | Good v1 / fallback. No real-time sync, but zero integration risk. Start here. |
| **Direct device APIs** (Fitbit Web API, Garmin Connect IQ, Apple HealthKit) | High | Best data fidelity | Each has its own OAuth flow, rate limits, and data schema — you'd be building N integrations, not one. Apple HealthKit specifically only works via a native iOS app (no direct web API), which is a real constraint if you stay web-only. |
| **Aggregator APIs** (Terra, Spike API, Vital) | Medium | Broad (one integration → many devices) | These exist specifically to solve the "N wearables, N APIs" problem. Paid, but likely your fastest path to real multi-device support without a team. |
| **Google Fit / Health Connect** | Medium | Android ecosystem | Reasonable if Android-first, doesn't help with Apple Watch users. |

**Recommendation**: build the CSV/manual import path first regardless — it validates the data model and gives you something to demo immediately. Then evaluate one aggregator (Terra or Vital) once you know which devices your actual users have, rather than hand-rolling Fitbit + Garmin + Apple integrations yourself. Given your current skill level is scripting-focused, hand-rolling multiple OAuth device integrations is exactly the kind of full-stack-heavy work where a technical co-founder or contractor would save you the most time.

## 5. Symptom Tracking Module

- **Daily quick-log**: severity slider(s) + optional free-text notes + optional tags (trigger candidates: food, weather, stress, sleep).
- **Condition templates**: pre-built field sets for common chronic conditions, customizable.
- **Trend view**: severity over time, overlaid with sleep/activity from the wearable data — this cross-reference is the app's core value prop.
- **Export**: a PDF/CSV symptom report is genuinely useful for doctor visits — cheap to build, high perceived value.

## 6. Training Plans Module

Two tiers, build in this order:

1. **Template-based plans**: pre-built progressions (couch-to-5k style, strength blocks, etc.) that populate `training_plan_sessions` on a schedule. This is straightforward CRUD + a scheduling function — no AI needed.
2. **Generated/adaptive plans**: use symptom + wearable trends to adjust the plan (e.g., auto-suggest a lighter session if sleep was poor or symptom severity was high the day before). This is where an LLM call (or a simpler rules engine first) adds real value — but it's a v2 feature, not v1.

Start with rules-based adaptation (if severity > 7, suggest rest day) before reaching for an AI model. It's simpler, explainable, and testable — you can layer an LLM-generated rationale/coaching-tone message on top later without it being load-bearing for correctness.

## 7. Suggested Build Order

1. Next.js project scaffold + SQLite + daily_log/manual data entry (no auth needed)
2. Symptom tracking module (fully manual — validates the core UX and data model)
3. CSV import for wearable data
4. Template-based training plans
5. Trend dashboard correlating symptoms + activity
6. Direct wearable API (e.g., Fitbit's free personal-use API) or aggregator, for live sync
7. Rules-based adaptive training plan
8. LLM-assisted plan rationale / coaching layer

Each numbered step above maps well to one spec file in the agentic coding workflow — small enough for an agent to implement and test in one sitting, in dependency order.
