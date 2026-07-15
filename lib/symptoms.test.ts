import { describe, it, expect, beforeEach } from "vitest";
import { createDb, type DB } from "./db";
import { seedDefaultConditions, listConditions } from "./conditions";
import {
  addSymptomEntry,
  listSymptomEntriesByDate,
  updateSymptomEntry,
  deleteSymptomEntry,
} from "./symptoms";

describe("symptom_entries", () => {
  let db: DB;
  let migraineId: number;
  let arthritisId: number;

  beforeEach(() => {
    db = createDb(":memory:");
    seedDefaultConditions(db);
    const byName = Object.fromEntries(listConditions(db).map((c) => [c.name, c.id]));
    migraineId = byName["Migraine"];
    arthritisId = byName["Rheumatoid Arthritis"];
  });

  function dailyLogCount(): number {
    return (db.prepare("SELECT COUNT(*) AS n FROM daily_logs").get() as { n: number }).n;
  }

  it("creates an entry linked to the correct day's daily_log", () => {
    const entry = addSymptomEntry(db, { date: "2026-07-15", conditionId: migraineId, severity: 6, notes: "aura" });
    expect(entry.id).toBeGreaterThan(0);
    expect(entry.date).toBe("2026-07-15");
    expect(entry.condition_name).toBe("Migraine");
    expect(entry.severity).toBe(6);
    expect(dailyLogCount()).toBe(1);
  });

  it("two symptoms on the same day reuse ONE daily_log", () => {
    addSymptomEntry(db, { date: "2026-07-15", conditionId: migraineId, severity: 6 });
    addSymptomEntry(db, { date: "2026-07-15", conditionId: arthritisId, severity: 4 });
    expect(dailyLogCount()).toBe(1);
    expect(listSymptomEntriesByDate(db, "2026-07-15").length).toBe(2);
  });

  it("rejects severity outside 1-10 on insert", () => {
    expect(() => addSymptomEntry(db, { date: "2026-07-15", conditionId: migraineId, severity: 0 })).toThrow();
    expect(() => addSymptomEntry(db, { date: "2026-07-15", conditionId: migraineId, severity: 11 })).toThrow();
  });

  it("rejects an unknown condition id", () => {
    expect(() => addSymptomEntry(db, { date: "2026-07-15", conditionId: 9999, severity: 5 })).toThrow();
  });

  it("edits an entry in place (condition, severity, notes)", () => {
    const e = addSymptomEntry(db, { date: "2026-07-15", conditionId: migraineId, severity: 6, notes: "aura" });
    const updated = updateSymptomEntry(db, e.id, { conditionId: arthritisId, severity: 8, notes: "flare" });
    expect(updated.id).toBe(e.id);
    expect(updated.condition_name).toBe("Rheumatoid Arthritis");
    expect(updated.severity).toBe(8);
    expect(updated.notes).toBe("flare");
  });

  it("rejects severity outside 1-10 on update", () => {
    const e = addSymptomEntry(db, { date: "2026-07-15", conditionId: migraineId, severity: 6 });
    expect(() => updateSymptomEntry(db, e.id, { severity: 0 })).toThrow();
    expect(() => updateSymptomEntry(db, e.id, { severity: 11 })).toThrow();
  });

  it("deletes an entry", () => {
    const e = addSymptomEntry(db, { date: "2026-07-15", conditionId: migraineId, severity: 6 });
    expect(deleteSymptomEntry(db, e.id)).toBe(true);
    expect(listSymptomEntriesByDate(db, "2026-07-15").length).toBe(0);
    expect(deleteSymptomEntry(db, e.id)).toBe(false); // already gone
  });
});
