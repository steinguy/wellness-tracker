import type { DB } from "./db";

export interface DailyLog {
  id: number;
  date: string; // YYYY-MM-DD
  created_at: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** True only for a well-formed, real calendar date in YYYY-MM-DD form. */
export function isValidDate(date: string): boolean {
  if (!DATE_RE.test(date)) return false;
  const d = new Date(`${date}T00:00:00Z`);
  // Reject impossible dates like 2026-02-30 (which JS would roll over).
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}

/**
 * Get the daily_log for `date`, creating it if absent. Idempotent: repeated
 * calls for the same date return the same row and never create a duplicate
 * (enforced by the UNIQUE(date) constraint + INSERT ... ON CONFLICT DO NOTHING).
 */
export function getOrCreateDailyLog(db: DB, date: string): DailyLog {
  if (!isValidDate(date)) {
    throw new Error(`Invalid date: "${date}". Expected format YYYY-MM-DD.`);
  }

  db.prepare(
    "INSERT INTO daily_logs (date) VALUES (?) ON CONFLICT(date) DO NOTHING"
  ).run(date);

  return db
    .prepare("SELECT id, date, created_at FROM daily_logs WHERE date = ?")
    .get(date) as DailyLog;
}
