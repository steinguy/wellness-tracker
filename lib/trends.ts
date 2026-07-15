import type { DB } from "./db";

export type SeverityKey = "severity_avg" | "severity_max";
export type MetricKey =
  | "steps"
  | "sleep_minutes"
  | "resting_hr"
  | "stress_avg"
  | "body_battery_low";

export interface DailyPoint {
  date: string;
  severity_avg: number | null;
  severity_max: number | null;
  steps: number | null;
  sleep_minutes: number | null;
  resting_hr: number | null;
  stress_avg: number | null;
  body_battery_low: number | null;
}

export interface SeriesQuery {
  start: string;
  end: string;
  conditionId?: number;
  source?: string;
}

export const METRIC_KEYS: MetricKey[] = [
  "steps",
  "sleep_minutes",
  "resting_hr",
  "stress_avg",
  "body_battery_low",
];

/**
 * Build one row per date (present in the range) with per-day symptom severity
 * (average + max) and the selected wearable source's metrics, merged by date.
 */
export function getDailySeries(db: DB, q: SeriesQuery): DailyPoint[] {
  const byDate = new Map<string, DailyPoint>();
  const ensure = (date: string): DailyPoint => {
    let row = byDate.get(date);
    if (!row) {
      row = {
        date,
        severity_avg: null,
        severity_max: null,
        steps: null,
        sleep_minutes: null,
        resting_hr: null,
        stress_avg: null,
        body_battery_low: null,
      };
      byDate.set(date, row);
    }
    return row;
  };

  // Severity per day (optionally filtered to one condition).
  const sevParams: unknown[] = [q.start, q.end];
  let condFilter = "";
  if (q.conditionId !== undefined) {
    condFilter = " AND se.condition_id = ?";
    sevParams.push(q.conditionId);
  }
  const sevRows = db
    .prepare(
      `SELECT dl.date AS date, AVG(se.severity) AS avg, MAX(se.severity) AS max
         FROM symptom_entries se
         JOIN daily_logs dl ON dl.id = se.daily_log_id
        WHERE dl.date BETWEEN ? AND ?${condFilter}
        GROUP BY dl.date`
    )
    .all(...sevParams) as Array<{ date: string; avg: number; max: number }>;
  for (const r of sevRows) {
    const row = ensure(r.date);
    row.severity_avg = r.avg;
    row.severity_max = r.max;
  }

  // Wearable metrics per day for the chosen source.
  const source = q.source ?? "csv";
  const wmRows = db
    .prepare(
      `SELECT dl.date AS date, wm.steps, wm.sleep_minutes, wm.resting_hr, wm.stress_avg, wm.body_battery_low
         FROM wearable_metrics wm
         JOIN daily_logs dl ON dl.id = wm.daily_log_id
        WHERE dl.date BETWEEN ? AND ? AND wm.source = ?`
    )
    .all(q.start, q.end, source) as Array<{
    date: string;
    steps: number | null;
    sleep_minutes: number | null;
    resting_hr: number | null;
    stress_avg: number | null;
    body_battery_low: number | null;
  }>;
  for (const r of wmRows) {
    const row = ensure(r.date);
    row.steps = r.steps;
    row.sleep_minutes = r.sleep_minutes;
    row.resting_hr = r.resting_hr;
    row.stress_avg = r.stress_avg;
    row.body_battery_low = r.body_battery_low;
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Distinct wearable sources present (for the source picker). */
export function listWearableSources(db: DB): string[] {
  return (
    db.prepare("SELECT DISTINCT source FROM wearable_metrics ORDER BY source").all() as Array<{
      source: string;
    }>
  ).map((r) => r.source);
}

/** Pearson correlation for paired numbers. null if n < 2 or a series is constant. */
export function pearson(pairs: Array<[number, number]>): number | null {
  const n = pairs.length;
  if (n < 2) return null;
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (const [x, y] of pairs) {
    sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y;
  }
  const cov = n * sxy - sx * sy;
  const vx = n * sxx - sx * sx;
  const vy = n * syy - sy * sy;
  if (vx <= 0 || vy <= 0) return null; // zero variance -> undefined correlation
  const r = cov / Math.sqrt(vx * vy);
  // clamp tiny FP overshoots
  return Math.max(-1, Math.min(1, r));
}

export interface Correlation {
  r: number | null;
  n: number;
}

/** Correlate one wearable metric against a severity key over days with both present. */
export function correlate(
  series: DailyPoint[],
  metric: MetricKey,
  severity: SeverityKey
): Correlation {
  const pairs: Array<[number, number]> = [];
  for (const p of series) {
    const m = p[metric];
    const s = p[severity];
    if (m !== null && m !== undefined && s !== null && s !== undefined) {
      pairs.push([m, s]);
    }
  }
  return { r: pearson(pairs), n: pairs.length };
}

export const MIN_SAMPLE = 7;

/** Plain-language read of a correlation, with a small-sample caveat. */
export function interpretR(r: number | null, n: number): string {
  if (r === null) return n < 2 ? "Not enough overlapping days yet." : "No variation to correlate.";
  if (n < MIN_SAMPLE) return `Only ${n} overlapping day(s) — too few to trust; keep logging.`;
  const a = Math.abs(r);
  const strength =
    a < 0.1 ? "no" : a < 0.3 ? "weak" : a < 0.5 ? "moderate" : a < 0.7 ? "strong" : "very strong";
  if (a < 0.1) return "No meaningful linear relationship.";
  const dir = r < 0 ? "negative" : "positive";
  return `${strength} ${dir} association (r = ${r.toFixed(2)}, n = ${n}) — association, not causation.`;
}
