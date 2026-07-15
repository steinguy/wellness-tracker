import type { DB } from "./db";
import { getOrCreateDailyLog } from "./daily-logs";
import { getCondition } from "./conditions";
import { todayISO } from "./date";

export interface SymptomEntry {
  id: number;
  daily_log_id: number;
  condition_id: number;
  severity: number;
  notes: string | null;
  logged_at: string;
}

/** A symptom entry joined with its date + condition name, for display. */
export interface SymptomEntryView extends SymptomEntry {
  date: string;
  condition_name: string;
}

export interface AddSymptomInput {
  date?: string; // defaults to today
  conditionId: number;
  severity: number;
  notes?: string | null;
}

export interface UpdateSymptomInput {
  conditionId?: number;
  severity?: number;
  notes?: string | null;
}

function assertSeverity(severity: number): void {
  if (!Number.isInteger(severity) || severity < 1 || severity > 10) {
    throw new Error(`Invalid severity: ${severity}. Expected an integer 1-10.`);
  }
}

function assertConditionExists(db: DB, conditionId: number): void {
  if (!getCondition(db, conditionId)) {
    throw new Error(`Unknown condition id: ${conditionId}.`);
  }
}

/** Create a symptom entry, resolving (or creating) the daily_log for its date. */
export function addSymptomEntry(db: DB, input: AddSymptomInput): SymptomEntryView {
  const date = input.date ?? todayISO();
  assertSeverity(input.severity);
  assertConditionExists(db, input.conditionId);

  const log = getOrCreateDailyLog(db, date); // reuse spec-01 day resolution
  const info = db
    .prepare(
      "INSERT INTO symptom_entries (daily_log_id, condition_id, severity, notes) VALUES (?, ?, ?, ?)"
    )
    .run(log.id, input.conditionId, input.severity, input.notes ?? null);

  return getSymptomEntry(db, Number(info.lastInsertRowid))!;
}

export function getSymptomEntry(db: DB, id: number): SymptomEntryView | undefined {
  return db
    .prepare(
      `SELECT se.id, se.daily_log_id, se.condition_id, se.severity, se.notes, se.logged_at,
              dl.date AS date, c.name AS condition_name
         FROM symptom_entries se
         JOIN daily_logs dl ON dl.id = se.daily_log_id
         JOIN conditions  c ON c.id = se.condition_id
        WHERE se.id = ?`
    )
    .get(id) as SymptomEntryView | undefined;
}

/** All entries for a given date (defaults to today), newest first. */
export function listSymptomEntriesByDate(db: DB, date: string = todayISO()): SymptomEntryView[] {
  return db
    .prepare(
      `SELECT se.id, se.daily_log_id, se.condition_id, se.severity, se.notes, se.logged_at,
              dl.date AS date, c.name AS condition_name
         FROM symptom_entries se
         JOIN daily_logs dl ON dl.id = se.daily_log_id
         JOIN conditions  c ON c.id = se.condition_id
        WHERE dl.date = ?
        ORDER BY se.logged_at DESC, se.id DESC`
    )
    .all(date) as SymptomEntryView[];
}

/** Edit an existing entry. Only provided fields change; same validation as insert. */
export function updateSymptomEntry(
  db: DB,
  id: number,
  patch: UpdateSymptomInput
): SymptomEntryView {
  const existing = getSymptomEntry(db, id);
  if (!existing) throw new Error(`Unknown symptom entry id: ${id}.`);

  if (patch.severity !== undefined) assertSeverity(patch.severity);
  if (patch.conditionId !== undefined) assertConditionExists(db, patch.conditionId);

  const severity = patch.severity ?? existing.severity;
  const conditionId = patch.conditionId ?? existing.condition_id;
  const notes = patch.notes !== undefined ? patch.notes : existing.notes;

  db.prepare(
    "UPDATE symptom_entries SET condition_id = ?, severity = ?, notes = ? WHERE id = ?"
  ).run(conditionId, severity, notes, id);

  return getSymptomEntry(db, id)!;
}

/** Delete an entry. Returns true if a row was removed. */
export function deleteSymptomEntry(db: DB, id: number): boolean {
  const info = db.prepare("DELETE FROM symptom_entries WHERE id = ?").run(id);
  return info.changes > 0;
}
