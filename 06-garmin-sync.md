# Spec 06: Live Wearable Sync — Garmin

> **STATUS: PARKED (future feature) — not implemented in the app.**
> Garmin's Health API requires developer-program approval and a public HTTPS webhook host, which isn't being pursued right now. The Garmin-specific wiring described below (OAuth2 PKCE flow, webhook routes, `lib/garmin.ts`, Connect UI, token tables) has been **removed** from the codebase. The reusable, source-agnostic groundwork was **kept**: `mergeUpsertWearableMetrics` (merge-preserve upsert), the `stress_*` / `body_battery_*` columns on `wearable_metrics`, and the stress/Body Battery overlays in the Trends dashboard. To revive this, obtain Garmin access and re-add an ingestor that calls `mergeUpsertWearableMetrics("garmin", date, partialFields)`; this spec is the blueprint.

## Goal
Pull the user's own Garmin data into `wearable_metrics` automatically via the Garmin Health API, so the trends dashboard reflects live device data without manual CSV export. Garmin only, single-user, using the free self-serve personal access.

## Depends on
- Spec 03 (`wearable_metrics`, CSV upsert), Spec 05 (trends). Reuses `getOrCreateDailyLog` and the `source` column (writes `source = "garmin"`).

## How Garmin works (constraints, not choices)
- **OAuth 2.0 PKCE** for authorization (code verifier/challenge).
- **Push, not pull.** After the user authorizes, Garmin POSTs data to registered HTTPS callback URLs when the watch syncs. A **30-day backfill** is triggered on first connect (Garmin pushes the history to the webhooks).
- **Idempotent required** — Garmin may resend; dedupe by `calendarDate` + `source`. The daily summary's `calendarDate` is the canonical day.
- **Body Battery is not in the daily summary** — it arrives in the Stress Details push (`timeOffsetBodyBatteryValues`). Stress average/max *are* in the daily summary.
- Webhooks need a **public HTTPS URL**; `localhost` can't receive pushes (use a tunnel like ngrok, or deploy).

## Decisions (confirmed with the user)
- **Metrics**: dailies (steps, active/BMR calories, resting HR) + **stress** (avg/max) + **Body Battery** (daily high/low) + sleep (minutes + stages). Adds new `wearable_metrics` columns.

## Scope
- Schema:
  - Extend `wearable_metrics` with nullable INTEGER columns: `stress_avg`, `stress_max`, `body_battery_high`, `body_battery_low`.
  - `garmin_tokens` (single row): `access_token`, `refresh_token`, `token_type`, `scope`, `expires_at`, `updated_at`.
  - `garmin_oauth_state`: `state` (PK), `code_verifier`, `created_at` — short-lived PKCE handshake storage.
- `/lib` (pure + testable):
  - `lib/garmin.ts`:
    - PKCE: `generateCodeVerifier()`, `codeChallenge(verifier)` (base64url SHA-256), `buildAuthorizeUrl({ clientId, redirectUri, state, challenge })`.
    - Normalizers (Garmin JSON → partial `wearable_metrics`): `normalizeDailySummary`, `normalizeSleep`, `normalizeStressDetails`. Each keys off `calendarDate`, tolerant of missing fields.
    - Token/state storage helpers; `exchangeCodeForTokens` + `triggerBackfill` (live `fetch` to Garmin — not exercised in tests).
  - `lib/wearables.ts`: add `mergeUpsertWearableMetrics(db, source, date, partialFields)` — merges the incoming fields with any existing `(day, source)` row so successive Garmin pushes (dailies, then stress, then sleep) accumulate rather than overwrite. (CSV import keeps its full-row upsert.)
- API:
  - `GET /api/garmin/connect` — create PKCE verifier + state, store, redirect to Garmin's authorize URL.
  - `GET /api/garmin/callback` — exchange code for tokens (live), save, trigger backfill, redirect home.
  - `GET /api/garmin/status` — `{ connected, expires_at }`.
  - `POST /api/garmin/disconnect` — clear tokens.
  - Webhooks (Garmin pushes here): `POST /api/garmin/webhook/dailies`, `/sleep`, `/stress` — normalize each item and `mergeUpsertWearableMetrics(source="garmin")`, always respond 200 fast.
- UI: a "Garmin" panel on `/` — Connect/Disconnect button, connection status, and a note that live sync needs the deployed/tunnelled webhook URLs registered in the Garmin developer portal. Today's metrics + the trends source picker pick up `source="garmin"` automatically.
- Trends: extend the overlay metric list + correlations to include `stress_avg` and `body_battery_low` (and keep steps/sleep/resting HR).
- Ship `sample-data/garmin/*.json` example payloads so the ingest pipeline can be exercised locally by POSTing them at the webhook routes.

## Explicitly out of scope
- Non-Garmin providers (Fitbit/Apple/aggregators) — later.
- Real-time activity/GPS detail, HRV, SpO2, respiration (only the metrics above).
- Multi-user token handling (single user, one token row).
- Automatic token refresh scheduling beyond refresh-on-expiry at call time.

## Acceptance criteria
1. `npm run dev` starts with no errors; `/` shows a Garmin panel with Connect + status.
2. PKCE: `codeChallenge(verifier)` equals base64url(SHA-256(verifier)); verifier length within 43–128.
3. Each normalizer maps its sample Garmin payload to the correct `wearable_metrics` fields, keyed by `calendarDate`; missing fields become absent (not 0).
4. `mergeUpsertWearableMetrics` accumulates across pushes: a dailies push then a stress push then a sleep push for the same date yield **one** `wearable_metrics` row (source `garmin`) holding all fields, with no duplicate `daily_logs`.
5. Re-sending the same push (Garmin duplicate) does not create duplicate rows or lose previously-set fields.
6. Trends includes `stress_avg` and `body_battery_low` as selectable overlay metrics with correlations.
7. Vitest covers PKCE correctness, all three normalizers, and merge-upsert accumulation/idempotency. `npm test` passes. (Live OAuth/backfill/webhook delivery is verified manually with real Garmin credentials + a public URL — documented, not unit-tested.)
8. `.env.example`, `PROGRESS.md`, `CLAUDE.md` updated; work committed with a descriptive message.

## Notes for the agent
- Keep all HTTP-to-Garmin behind small functions; normalization + PKCE + merge must be pure and DB-injected so they're testable without network.
- Field names follow Garmin's Health API spec (`calendarDate`, `steps`, `activeKilocalories`, `bmrKilocalories`, `restingHeartRateInBeatsPerMinute`, `averageStressLevel`, `maxStressLevel`; sleep `durationInSeconds` + stage durations; stress `timeOffsetBodyBatteryValues`). These sit behind Garmin's dev portal — treat the mapping table as the single place to correct if a real payload differs, and say so in comments.
- Webhooks must respond 200 quickly and be idempotent; never throw out of the handler on a single bad item — skip and continue.
- Secrets (`GARMIN_CLIENT_ID`, `GARMIN_CLIENT_SECRET`, `GARMIN_REDIRECT_URI`) come from env; never commit them. Provide `.env.example`.
