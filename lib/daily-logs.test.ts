import { describe, it, expect, beforeEach } from "vitest";
import { createDb, type DB } from "./db";
import { getOrCreateDailyLog, isValidDate } from "./daily-logs";

function count(db: DB): number {
  return (db.prepare("SELECT COUNT(*) AS n FROM daily_logs").get() as { n: number }).n;
}

describe("getOrCreateDailyLog", () => {
  let db: DB;

  beforeEach(() => {
    db = createDb(":memory:");
  });

  it("creates a row on the first call", () => {
    const log = getOrCreateDailyLog(db, "2026-07-15");
    expect(log.id).toBeGreaterThan(0);
    expect(log.date).toBe("2026-07-15");
    expect(count(db)).toBe(1);
  });

  it("returns the same row on a second call for the same date (no duplicate)", () => {
    const first = getOrCreateDailyLog(db, "2026-07-15");
    const second = getOrCreateDailyLog(db, "2026-07-15");
    expect(second.id).toBe(first.id);
    expect(second.created_at).toBe(first.created_at);
    expect(count(db)).toBe(1);
  });

  it("creates distinct rows for different dates", () => {
    const a = getOrCreateDailyLog(db, "2026-07-15");
    const b = getOrCreateDailyLog(db, "2026-07-16");
    expect(b.id).not.toBe(a.id);
    expect(count(db)).toBe(2);
  });

  it("rejects malformed or impossible dates", () => {
    expect(() => getOrCreateDailyLog(db, "07/15/2026")).toThrow();
    expect(isValidDate("2026-02-30")).toBe(false);
    expect(isValidDate("2026-07-15")).toBe(true);
  });
});
