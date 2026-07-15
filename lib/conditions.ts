import type { DB } from "./db";

export interface Condition {
  id: number;
  name: string;
  tracked_fields: string; // JSON text
  created_at: string;
}

// Starter templates. tracked_fields is intentionally minimal for v1 — the point
// is that custom fields live per-condition as JSON, not that the UI renders them yet.
const DEFAULT_CONDITIONS: string[] = [
  "Migraine",
  "Rheumatoid Arthritis",
  "Crohn's Disease",
];

/** Insert the starter conditions if absent. Idempotent (UNIQUE name + INSERT OR IGNORE). */
export function seedDefaultConditions(db: DB): void {
  const insert = db.prepare(
    "INSERT OR IGNORE INTO conditions (name) VALUES (?)"
  );
  const seed = db.transaction((names: string[]) => {
    for (const name of names) insert.run(name);
  });
  seed(DEFAULT_CONDITIONS);
}

export function listConditions(db: DB): Condition[] {
  return db
    .prepare("SELECT id, name, tracked_fields, created_at FROM conditions ORDER BY name")
    .all() as Condition[];
}

export function getCondition(db: DB, id: number): Condition | undefined {
  return db
    .prepare("SELECT id, name, tracked_fields, created_at FROM conditions WHERE id = ?")
    .get(id) as Condition | undefined;
}

export function createCondition(
  db: DB,
  name: string,
  trackedFields: string = '{"fields":[]}'
): Condition {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Condition name is required.");
  try {
    JSON.parse(trackedFields);
  } catch {
    throw new Error("tracked_fields must be valid JSON.");
  }
  const info = db
    .prepare("INSERT INTO conditions (name, tracked_fields) VALUES (?, ?)")
    .run(trimmed, trackedFields);
  return getCondition(db, Number(info.lastInsertRowid))!;
}
