import Papa from "papaparse";
import type { DB } from "./db";
import { getOrCreateDailyLog, isValidDate } from "./daily-logs";

// Numeric columns we accept from a CSV, mapped 1:1 to wearable_metrics columns.
const NUMERIC_FIELDS = [
  "steps",
  "calories_active",
  "calories_resting",
  "sleep_minutes",
  "resting_hr",
] as const;
type NumericField = (typeof NUMERIC_FIELDS)[number];

export interface WearableMetric {
  id: number;
  daily_log_id: number;
  source: string;
  steps: number | null;
  calories_active: number | null;
  calories_resting: number | null;
  sleep_minutes: number | null;
  resting_hr: number | null;
  stress_avg: number | null;
  stress_max: number | null;
  body_battery_high: number | null;
  body_battery_low: number | null;
  sleep_stages: string | null;
  synced_at: string;
}

/** Partial metric fields for a merge-upsert (e.g. one Garmin push carries a subset). */
export interface WearablePartial {
  steps?: number | null;
  calories_active?: number | null;
  calories_resting?: number | null;
  sleep_minutes?: number | null;
  resting_hr?: number | null;
  stress_avg?: number | null;
  stress_max?: number | null;
  body_battery_high?: number | null;
  body_battery_low?: number | null;
  sleep_stages?: string | null;
}

const WM_MERGE_FIELDS = [
  "steps",
  "calories_active",
  "calories_resting",
  "sleep_minutes",
  "resting_hr",
  "stress_avg",
  "stress_max",
  "body_battery_high",
  "body_battery_low",
  "sleep_stages",
] as const;

/**
 * Upsert a partial metric set for (date, source), MERGING with any existing row so
 * successive pushes (e.g. Garmin dailies, then stress, then sleep) accumulate rather
 * than overwrite. Only fields present in `fields` change; others are preserved.
 * Idempotent: re-sending the same payload keeps the row unchanged.
 */
export function mergeUpsertWearableMetrics(
  db: DB,
  source: string,
  date: string,
  fields: WearablePartial
): "imported" | "updated" {
  if (!isValidDate(date)) throw new Error(`Invalid date: "${date}". Expected YYYY-MM-DD.`);
  const log = getOrCreateDailyLog(db, date);
  const existing = db
    .prepare("SELECT * FROM wearable_metrics WHERE daily_log_id = ? AND source = ?")
    .get(log.id, source) as Record<string, unknown> | undefined;

  const merged: Record<string, unknown> = { daily_log_id: log.id, source };
  for (const f of WM_MERGE_FIELDS) {
    const incoming = fields[f as keyof WearablePartial];
    merged[f] = incoming !== undefined ? incoming : existing ? existing[f] ?? null : null;
  }

  db.prepare(
    `INSERT INTO wearable_metrics
       (daily_log_id, source, steps, calories_active, calories_resting, sleep_minutes, resting_hr,
        stress_avg, stress_max, body_battery_high, body_battery_low, sleep_stages, synced_at)
     VALUES (@daily_log_id, @source, @steps, @calories_active, @calories_resting, @sleep_minutes, @resting_hr,
             @stress_avg, @stress_max, @body_battery_high, @body_battery_low, @sleep_stages, datetime('now'))
     ON CONFLICT(daily_log_id, source) DO UPDATE SET
       steps             = excluded.steps,
       calories_active   = excluded.calories_active,
       calories_resting  = excluded.calories_resting,
       sleep_minutes     = excluded.sleep_minutes,
       resting_hr        = excluded.resting_hr,
       stress_avg        = excluded.stress_avg,
       stress_max        = excluded.stress_max,
       body_battery_high = excluded.body_battery_high,
       body_battery_low  = excluded.body_battery_low,
       sleep_stages      = excluded.sleep_stages,
       synced_at         = datetime('now')`
  ).run(merged);

  return existing ? "updated" : "imported";
}

export interface ParsedWearableRow {
  date: string;
  steps: number | null;
  calories_active: number | null;
  calories_resting: number | null;
  sleep_minutes: number | null;
  resting_hr: number | null;
  sleep_stages: string | null;
}

export interface RowError {
  row: number; // 1-based data row number (excludes header)
  message: string;
}

export interface ParseResult {
  rows: ParsedWearableRow[];
  errors: RowError[];
}

export interface ImportSummary {
  imported: number; // new rows inserted
  updated: number; // existing rows updated
  skipped: number; // rows rejected during parsing
  errors: RowError[];
}

/** Parse "" / undefined -> null; a non-negative integer -> number; else throw. */
function parseOptionalInt(raw: unknown, field: string): number | null {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (s === "") return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
    throw new Error(`"${field}" must be a non-negative integer (got "${s}")`);
  }
  return n;
}

function validateSleepStages(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (s === "") return null;
  try {
    JSON.parse(s);
  } catch {
    throw new Error(`"sleep_stages" must be valid JSON if present`);
  }
  return s;
}

/** Parse wearable CSV text into validated rows. Bad rows are reported, not thrown. */
export function parseWearableCsv(text: string): ParseResult {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  const rows: ParsedWearableRow[] = [];
  const errors: RowError[] = [];

  parsed.data.forEach((record, i) => {
    const rowNum = i + 1;
    try {
      const date = String(record["date"] ?? "").trim();
      if (!isValidDate(date)) {
        throw new Error(`invalid or missing "date" (expected YYYY-MM-DD)`);
      }
      const row: ParsedWearableRow = {
        date,
        steps: null,
        calories_active: null,
        calories_resting: null,
        sleep_minutes: null,
        resting_hr: null,
        sleep_stages: validateSleepStages(record["sleep_stages"]),
      };
      for (const f of NUMERIC_FIELDS) {
        row[f as NumericField] = parseOptionalInt(record[f], f);
      }
      rows.push(row);
    } catch (err) {
      errors.push({ row: rowNum, message: (err as Error).message });
    }
  });

  return { rows, errors };
}

/** Upsert one parsed row into wearable_metrics for (date, source). Returns "imported" | "updated". */
function upsertRow(db: DB, row: ParsedWearableRow, source: string): "imported" | "updated" {
  const log = getOrCreateDailyLog(db, row.date);
  const existing = db
    .prepare("SELECT id FROM wearable_metrics WHERE daily_log_id = ? AND source = ?")
    .get(log.id, source);

  db.prepare(
    `INSERT INTO wearable_metrics
       (daily_log_id, source, steps, calories_active, calories_resting, sleep_minutes, resting_hr, sleep_stages, synced_at)
     VALUES (@daily_log_id, @source, @steps, @calories_active, @calories_resting, @sleep_minutes, @resting_hr, @sleep_stages, datetime('now'))
     ON CONFLICT(daily_log_id, source) DO UPDATE SET
       steps            = excluded.steps,
       calories_active  = excluded.calories_active,
       calories_resting = excluded.calories_resting,
       sleep_minutes    = excluded.sleep_minutes,
       resting_hr       = excluded.resting_hr,
       sleep_stages     = excluded.sleep_stages,
       synced_at        = datetime('now')`
  ).run({
    daily_log_id: log.id,
    source,
    steps: row.steps,
    calories_active: row.calories_active,
    calories_resting: row.calories_resting,
    sleep_minutes: row.sleep_minutes,
    resting_hr: row.resting_hr,
    sleep_stages: row.sleep_stages,
  });

  return existing ? "updated" : "imported";
}

/** Parse + upsert a CSV. Wrapped in a transaction; bad rows are skipped and reported. */
export function importWearableCsv(db: DB, text: string, source = "csv"): ImportSummary {
  const { rows, errors } = parseWearableCsv(text);
  let imported = 0;
  let updated = 0;

  const run = db.transaction((toImport: ParsedWearableRow[]) => {
    for (const row of toImport) {
      if (upsertRow(db, row, source) === "imported") imported++;
      else updated++;
    }
  });
  run(rows);

  return { imported, updated, skipped: errors.length, errors };
}

export function getWearableMetricsByDate(db: DB, date: string): WearableMetric[] {
  return db
    .prepare(
      `SELECT wm.*
         FROM wearable_metrics wm
         JOIN daily_logs dl ON dl.id = wm.daily_log_id
        WHERE dl.date = ?
        ORDER BY wm.source`
    )
    .all(date) as WearableMetric[];
}
