import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export type DB = Database.Database;

// Schema for spec 01. Later specs extend this (symptoms, wearable metrics, etc.).
// `date` is the natural key we correlate everything on, so it is UNIQUE.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS daily_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  date       TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

/** Apply schema migrations. Idempotent (CREATE TABLE IF NOT EXISTS). */
export function migrate(db: DB): void {
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA);
}

/**
 * Open a database at `filename` (use ":memory:" for tests) and run migrations.
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
