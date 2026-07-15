import { describe, it, expect, beforeEach } from "vitest";
import { createDb, type DB } from "./db";
import {
  parseWearableCsv,
  importWearableCsv,
  getWearableMetricsByDate,
} from "./wearables";

const VALID_CSV = `date,steps,calories_active,calories_resting,sleep_minutes,resting_hr,device_note
2026-07-13,8421,412,1580,437,58,"good day, walked to work"
2026-07-14,5123,240,1575,388,61,restless night
2026-07-15,10233,530,1602,455,57,
`;

function metricCount(db: DB): number {
  return (db.prepare("SELECT COUNT(*) AS n FROM wearable_metrics").get() as { n: number }).n;
}
function dailyLogCount(db: DB): number {
  return (db.prepare("SELECT COUNT(*) AS n FROM daily_logs").get() as { n: number }).n;
}

describe("parseWearableCsv", () => {
  it("parses valid rows and maps known columns", () => {
    const { rows, errors } = parseWearableCsv(VALID_CSV);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      date: "2026-07-13",
      steps: 8421,
      calories_active: 412,
      calories_resting: 1580,
      sleep_minutes: 437,
      resting_hr: 58,
    });
  });

  it("ignores unknown columns (device_note) and stores blanks as null", () => {
    const { rows } = parseWearableCsv(VALID_CSV);
    // device_note is not a field on the parsed row
    expect("device_note" in rows[0]).toBe(false);
    // trailing blank resting-note row still parses; blank numeric -> null
    const { rows: r2 } = parseWearableCsv("date,steps,resting_hr\n2026-07-15,,\n");
    expect(r2[0].steps).toBeNull();
    expect(r2[0].resting_hr).toBeNull();
  });

  it("reports bad rows without aborting the good ones", () => {
    const csv = `date,steps
notadate,100
2026-07-15,-5
2026-07-16,900
2026-07-17,3.5`;
    const { rows, errors } = parseWearableCsv(csv);
    expect(rows.map((r) => r.date)).toEqual(["2026-07-16"]);
    expect(errors).toHaveLength(3); // bad date, negative, non-integer
    expect(errors[0].row).toBe(1);
  });
});

describe("importWearableCsv", () => {
  let db: DB;
  beforeEach(() => {
    db = createDb(":memory:");
  });

  it("imports one row per date, tied to a daily_log, creating days as needed", () => {
    const summary = importWearableCsv(db, VALID_CSV);
    expect(summary.imported).toBe(3);
    expect(summary.updated).toBe(0);
    expect(metricCount(db)).toBe(3);
    expect(dailyLogCount(db)).toBe(3);

    const day = getWearableMetricsByDate(db, "2026-07-14");
    expect(day).toHaveLength(1);
    expect(day[0].steps).toBe(5123);
    expect(day[0].source).toBe("csv");
  });

  it("re-importing the same CSV updates in place (no duplicates)", () => {
    importWearableCsv(db, VALID_CSV);
    const second = importWearableCsv(db, VALID_CSV);
    expect(second.imported).toBe(0);
    expect(second.updated).toBe(3);
    expect(metricCount(db)).toBe(3);
    expect(dailyLogCount(db)).toBe(3);
  });

  it("updates changed values on re-import", () => {
    importWearableCsv(db, "date,steps\n2026-07-15,100\n");
    importWearableCsv(db, "date,steps\n2026-07-15,999\n");
    expect(getWearableMetricsByDate(db, "2026-07-15")[0].steps).toBe(999);
    expect(metricCount(db)).toBe(1);
  });

  it("keeps different sources side by side for the same day", () => {
    importWearableCsv(db, "date,steps\n2026-07-15,100\n", "csv");
    importWearableCsv(db, "date,steps\n2026-07-15,200\n", "fitbit");
    expect(getWearableMetricsByDate(db, "2026-07-15")).toHaveLength(2);
    expect(dailyLogCount(db)).toBe(1);
  });

  it("counts skipped rows and returns their errors", () => {
    const summary = importWearableCsv(db, "date,steps\nbad,1\n2026-07-15,10\n");
    expect(summary.imported).toBe(1);
    expect(summary.skipped).toBe(1);
    expect(summary.errors).toHaveLength(1);
  });
});
