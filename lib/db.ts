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

CREATE TABLE IF NOT EXISTS wearable_metrics (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  daily_log_id    INTEGER NOT NULL REFERENCES daily_logs(id) ON DELETE CASCADE,
  source          TEXT NOT NULL DEFAULT 'csv', -- csv / fitbit / apple / manual ...
  steps           INTEGER,
  calories_active INTEGER,
  calories_resting INTEGER,
  sleep_minutes   INTEGER,
  resting_hr      INTEGER,
  stress_avg      INTEGER,
  stress_max      INTEGER,
  body_battery_high INTEGER,
  body_battery_low  INTEGER,
  sleep_stages    TEXT,                         -- JSON, optional
  synced_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (daily_log_id, source)                 -- upsert target: one row per day per source
);

CREATE INDEX IF NOT EXISTS idx_wearable_metrics_daily_log
  ON wearable_metrics (daily_log_id);

CREATE TABLE IF NOT EXISTS training_plans (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  goal         TEXT,
  start_date   TEXT NOT NULL,
  generated_by TEXT NOT NULL DEFAULT 'template', -- template / ai / manual
  template_key TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS training_plan_sessions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  training_plan_id INTEGER NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
  scheduled_date  TEXT NOT NULL,
  workout_type    TEXT NOT NULL,
  target_metrics  TEXT,               -- JSON
  completed       INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0,1)),
  actual_metrics  TEXT,               -- JSON, set when completed
  completed_at    TEXT
);

CREATE INDEX IF NOT EXISTS idx_plan_sessions_plan
  ON training_plan_sessions (training_plan_id);
`;

/** Apply schema migrations + connection pragmas. Idempotent. */
function addColumnIfMissing(db: DB, table: string, column: string, type: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
}

export function migrate(db: DB): void {
  // Foreign keys are OFF by default in SQLite and must be enabled per connection.
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA);

  // Spec 06: columns added to wearable_metrics after it may already exist.
  for (const [col, type] of [
    ["stress_avg", "INTEGER"],
    ["stress_max", "INTEGER"],
    ["body_battery_high", "INTEGER"],
    ["body_battery_low", "INTEGER"],
  ] as const) {
    addColumnIfMissing(db, "wearable_metrics", col, type);
  }
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
