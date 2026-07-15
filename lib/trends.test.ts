import { describe, it, expect, beforeEach } from "vitest";
import { createDb, type DB } from "./db";
import { seedDefaultConditions, listConditions } from "./conditions";
import { addSymptomEntry } from "./symptoms";
import { importWearableCsv } from "./wearables";
import { getDailySeries, pearson, correlate } from "./trends";

describe("pearson", () => {
  it("returns +1 / -1 for perfectly correlated inputs", () => {
    expect(pearson([[1, 1], [2, 2], [3, 3]])).toBeCloseTo(1, 10);
    expect(pearson([[1, 3], [2, 2], [3, 1]])).toBeCloseTo(-1, 10);
  });
  it("returns ~0 for uncorrelated inputs", () => {
    const r = pearson([[1, 2], [2, 2], [3, 2.0001], [4, 1.9999]]);
    expect(Math.abs(r as number)).toBeLessThan(0.5);
  });
  it("returns null for n < 2 or zero variance", () => {
    expect(pearson([[1, 1]])).toBeNull();
    expect(pearson([[1, 5], [1, 9], [1, 3]])).toBeNull(); // constant x
  });
});

describe("getDailySeries", () => {
  let db: DB;
  let migraineId: number;
  let crohnsId: number;
  beforeEach(() => {
    db = createDb(":memory:");
    seedDefaultConditions(db);
    const byName = Object.fromEntries(listConditions(db).map((c) => [c.name, c.id]));
    migraineId = byName["Migraine"];
    crohnsId = byName["Crohn's Disease"];
  });

  it("computes per-day average and max severity", () => {
    addSymptomEntry(db, { date: "2026-07-10", conditionId: migraineId, severity: 4 });
    addSymptomEntry(db, { date: "2026-07-10", conditionId: crohnsId, severity: 8 });
    addSymptomEntry(db, { date: "2026-07-11", conditionId: migraineId, severity: 5 });

    const series = getDailySeries(db, { start: "2026-07-01", end: "2026-07-31" });
    const d10 = series.find((p) => p.date === "2026-07-10")!;
    expect(d10.severity_avg).toBe(6);
    expect(d10.severity_max).toBe(8);
    const d11 = series.find((p) => p.date === "2026-07-11")!;
    expect(d11.severity_avg).toBe(5);
    expect(d11.severity_max).toBe(5);
  });

  it("filters severity by condition when set", () => {
    addSymptomEntry(db, { date: "2026-07-10", conditionId: migraineId, severity: 4 });
    addSymptomEntry(db, { date: "2026-07-10", conditionId: crohnsId, severity: 9 });
    const series = getDailySeries(db, { start: "2026-07-01", end: "2026-07-31", conditionId: migraineId });
    const d10 = series.find((p) => p.date === "2026-07-10")!;
    expect(d10.severity_max).toBe(4); // crohns excluded
  });

  it("merges wearable metrics by date and leaves gaps null", () => {
    addSymptomEntry(db, { date: "2026-07-10", conditionId: migraineId, severity: 5 });
    importWearableCsv(db, "date,steps,sleep_minutes\n2026-07-10,8000,420\n2026-07-12,5000,360\n");
    const series = getDailySeries(db, { start: "2026-07-01", end: "2026-07-31" });

    const d10 = series.find((p) => p.date === "2026-07-10")!;
    expect(d10.steps).toBe(8000);
    expect(d10.sleep_minutes).toBe(420);
    expect(d10.severity_max).toBe(5);

    const d12 = series.find((p) => p.date === "2026-07-12")!;
    expect(d12.steps).toBe(5000);
    expect(d12.severity_max).toBeNull(); // wearable-only day
  });

  it("only correlates days where both values are present", () => {
    // 3 aligned days: severity down as sleep up -> perfect negative correlation
    addSymptomEntry(db, { date: "2026-07-10", conditionId: migraineId, severity: 8 });
    addSymptomEntry(db, { date: "2026-07-11", conditionId: migraineId, severity: 6 });
    addSymptomEntry(db, { date: "2026-07-12", conditionId: migraineId, severity: 4 });
    // extra symptom-only day (no wearable) should be excluded from correlation
    addSymptomEntry(db, { date: "2026-07-15", conditionId: migraineId, severity: 9 });
    importWearableCsv(db, "date,sleep_minutes\n2026-07-10,300\n2026-07-11,400\n2026-07-12,500\n");

    const series = getDailySeries(db, { start: "2026-07-01", end: "2026-07-31" });
    const c = correlate(series, "sleep_minutes", "severity_max");
    expect(c.n).toBe(3);
    expect(c.r).toBeCloseTo(-1, 10);
  });
});
