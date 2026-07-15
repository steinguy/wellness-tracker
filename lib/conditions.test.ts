import { describe, it, expect, beforeEach } from "vitest";
import { createDb, type DB } from "./db";
import { seedDefaultConditions, listConditions, createCondition } from "./conditions";

describe("conditions", () => {
  let db: DB;
  beforeEach(() => {
    db = createDb(":memory:");
  });

  it("seeds the three starter conditions", () => {
    seedDefaultConditions(db);
    const names = listConditions(db).map((c) => c.name);
    expect(names).toEqual(["Crohn's Disease", "Migraine", "Rheumatoid Arthritis"]); // ORDER BY name
  });

  it("seeding is idempotent across repeated calls (no duplicates)", () => {
    seedDefaultConditions(db);
    seedDefaultConditions(db);
    seedDefaultConditions(db);
    expect(listConditions(db).length).toBe(3);
  });

  it("creates a custom condition and rejects invalid JSON tracked_fields", () => {
    const c = createCondition(db, "Custom", '{"fields":[{"key":"pain"}]}');
    expect(c.id).toBeGreaterThan(0);
    expect(() => createCondition(db, "Bad", "{not json")).toThrow();
    expect(() => createCondition(db, "   ")).toThrow();
  });
});
