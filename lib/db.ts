import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export type DB = Database.Database;

// Schema. Each spec extends it. `date` on daily_logs is the natural key we
// correlate everything on (symptoms now; wearable metrics later), so it's UNIQUE.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS daily_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  date       TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS conditions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT NOT NULL UNIQUE,
  tracked_fields TEXT NOT NULL DEFAULT '{"fields":[]}', -- JSON: per-condition custom fields
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS symptom_entries (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  daily_log_id INTEGER NOT NULL REFERENCES daily_logs(id) ON DELETE CASCADE,
  condition_id INTEGER NOT NULL REFERENCES conditions(id),
  severity     INTEGER NOT NULL CHECK (severity BETWEEN 1 AND 10),
  notes        TEXT,
  logged_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_symptom_entries_daily_log
  ON symptom_entries (daily_log_id);
`;

/** Apply schema migrations + connection pragmas. Idempotent. */
export function migrate(db: DB): void {
  // Foreign keys are OFF by default in SQLite and must be enabled per connection.
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA);
}

/**
 * Open a database at `filename` (":memory:" for tests) and run migrations.
 * A fresh, isolated connection is returned each call — handy for testing.
 */
export function createDb(filename: string): DB {
  if (filename !== ":memory:") {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
  }
  const db = new Database(filename);
  migrate(db);
  return db;
}

let singleton: DB | null = null;

/** Process-wide singleton connection used by the app (API routes, pages). */
export function getDb(): DB {
  if (!singleton) {
    const file =
      process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "wellness.db");
    singleton = createDb(file);
  }
  return singleton;
}
