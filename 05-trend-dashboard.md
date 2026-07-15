# Spec 05: Trend Dashboard (Symptoms × Activity)

## Goal
Surface the app's core value: overlay daily symptom severity against wearable metrics (sleep, steps, resting HR) over a date range, and quantify the relationship (e.g. "does poor sleep predict worse symptom days?") with a correlation number. This is a read-only analytics view over data from specs 02 and 03 — no new data entry.

## Depends on
- Spec 02 (`symptom_entries`, `conditions`), Spec 03 (`wearable_metrics`), Spec 01 (`daily_logs`, date helpers).

## Decisions (confirmed with the user)
- **Charting**: Recharts (approved new dependency — React-native axes/tooltips/legends).
- **Correlation**: compute **Pearson r** per wearable metric vs. severity, with a plain-language read and a small-sample guard.
- **Severity aggregation**: per day, both **average** and **max** (daily worst).

## Scope
- Read-only aggregation in `/lib` — `lib/trends.ts`:
  - `getDailySeries(db, { start, end, conditionId?, source? })` → one row per date present in the range, each with:
    `date`, `severity_avg` (mean of that day's `symptom_entries.severity`), `severity_max` (worst), and wearable fields `steps`, `sleep_minutes`, `resting_hr`. Missing values are `null`. `conditionId` filters severity to one condition; `source` selects which wearable source (default the first available / `csv`).
  - `pearson(pairs)` → correlation coefficient in [−1, 1], or `null` when n < 2 or a series has zero variance.
  - `correlate(series, metricKey, severityKey)` → `{ r, n }` over days where **both** values are present.
  - `interpretR(r, n)` → plain-language read ("moderate negative — less sleep tends to go with worse days"), with a minimum-sample note when `n < 7`.
- API — `GET /api/trends?start=&end=&conditionId=&source=`:
  - Returns `{ series, sources, correlations }` where `correlations` covers each wearable metric (`steps`, `sleep_minutes`, `resting_hr`) against both `severity_avg` and `severity_max` as `{ r, n }`.
  - Validates dates; defaults to the last 30 days when omitted.
- UI — a `/trends` page (linked from `/`):
  - Controls: start/end date, condition filter (All + each condition), wearable source, and which wearable metric to overlay.
  - A Recharts chart: shared date X-axis; left Y-axis = severity 0–10 with two lines (average + max); right Y-axis = the selected wearable metric line.
  - A correlation callout for the selected metric vs. severity (both avg and max): the r value, a plain-language interpretation, and the number of overlapping days — with an explicit "not enough data" / "association, not causation" caveat.

## Explicitly out of scope for this spec
- Editing or entering data (this view is read-only).
- Multivariate / lagged analysis (e.g. yesterday's sleep vs. today's symptoms) — single-day, single-metric Pearson only for now.
- PDF/CSV export of the dashboard (later).
- Auth of any kind.

## Acceptance criteria
1. `npm install` picks up Recharts; `npm run dev` starts with no errors; `/trends` renders with the last-30-days default range.
2. The daily series correctly computes per-day `severity_avg` and `severity_max` from `symptom_entries`, filtered by condition when set, and merges the selected source's wearable metrics by date.
3. `pearson` returns correct coefficients (±1 for perfectly correlated inputs, ~0 for uncorrelated) and `null` for n < 2 or zero-variance input.
4. `correlate` only pairs days where both the metric and the severity value exist, and reports `n`; the UI shows a small-sample caveat when `n < 7`.
5. The chart overlays severity (avg + max) and the chosen wearable metric on a shared date axis; changing controls updates chart + correlation.
6. Vitest covers: daily-series aggregation (avg/max, condition filter, wearable merge, missing values), Pearson correctness + null cases, and `correlate` pairing/`n`. `npm test` passes.
7. `PROGRESS.md` / `CLAUDE.md` updated (Recharts dependency); work committed with a descriptive message.

## Notes for the agent
- Keep all aggregation and stats in `/lib` and pure/unit-testable; the API route and page stay thin. Pearson must not require a DB.
- Recharts is client-only — the chart lives in a `"use client"` component; guard against SSR width issues (render the chart after mount, fixed height + `ResponsiveContainer`).
- Correlation is descriptive, not causal — the UI copy must say so, and must not over-claim on small samples.
- Reuse existing date helpers (`addDays`, `todayISO`) for the default range; validate range inputs with `isValidDate`.
