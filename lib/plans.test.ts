import { describe, it, expect, beforeEach } from "vitest";
import { createDb, type DB } from "./db";
import {
  createPlanFromTemplate,
  listPlans,
  getPlan,
  deletePlan,
  completeSession,
  uncompleteSession,
} from "./plans";

describe("training plans", () => {
  let db: DB;
  beforeEach(() => {
    db = createDb(":memory:");
  });

  it("generates the right session count and dates from a template", () => {
    const plan = createPlanFromTemplate(db, "couch-to-5k", "2026-07-15");
    expect(plan.name).toBe("Couch to 5K");
    expect(plan.template_key).toBe("couch-to-5k");
    expect(plan.generated_by).toBe("template");
    expect(plan.sessions.length).toBe(27); // 9 weeks x 3
    // first session on the start date, ordered ascending
    expect(plan.sessions[0].scheduled_date).toBe("2026-07-15");
    // week 1 day offsets are 0,2,4
    expect(plan.sessions[1].scheduled_date).toBe("2026-07-17");
    expect(plan.sessions[2].scheduled_date).toBe("2026-07-19");
  });

  it("generates the expected counts for each template", () => {
    expect(createPlanFromTemplate(db, "beginner-strength", "2026-07-15").sessions.length).toBe(24);
    expect(createPlanFromTemplate(db, "5k-to-10k", "2026-07-15").sessions.length).toBe(18);
  });

  it("rejects unknown template or bad start date", () => {
    expect(() => createPlanFromTemplate(db, "nope", "2026-07-15")).toThrow();
    expect(() => createPlanFromTemplate(db, "couch-to-5k", "07/15/2026")).toThrow();
  });

  it("marks a session done with actuals and reverts", () => {
    const plan = createPlanFromTemplate(db, "5k-to-10k", "2026-07-15");
    const s = plan.sessions[0];
    const done = completeSession(db, s.id, { duration_min: 32, distance: 5, distance_unit: "km", rpe: 6, notes: "felt ok" });
    expect(done.completed).toBe(1);
    expect(done.completed_at).not.toBeNull();
    expect(JSON.parse(done.actual_metrics!)).toMatchObject({ duration_min: 32, distance_km: 5, distance_unit: "km", rpe: 6, notes: "felt ok" });

    const reverted = uncompleteSession(db, s.id);
    expect(reverted.completed).toBe(0);
    expect(reverted.actual_metrics).toBeNull();
    expect(reverted.completed_at).toBeNull();
  });

  it("validates actuals (rpe range, non-negative numbers, unit)", () => {
    const plan = createPlanFromTemplate(db, "5k-to-10k", "2026-07-15");
    const id = plan.sessions[0].id;
    expect(() => completeSession(db, id, { rpe: 11 })).toThrow();
    expect(() => completeSession(db, id, { rpe: 0 })).toThrow();
    expect(() => completeSession(db, id, { duration_min: -5 })).toThrow();
    // @ts-expect-error - invalid unit should be rejected at runtime
    expect(() => completeSession(db, id, { distance: 5, distance_unit: "furlongs" })).toThrow();
  });

  it("converts miles to canonical km and remembers the entered unit", () => {
    const plan = createPlanFromTemplate(db, "5k-to-10k", "2026-07-15");
    const id = plan.sessions[0].id;
    const done = completeSession(db, id, { distance: 3, distance_unit: "mi" });
    const stored = JSON.parse(done.actual_metrics!);
    expect(stored.distance_km).toBeCloseTo(4.828, 3); // 3 * 1.609344
    expect(stored.distance_unit).toBe("mi");
  });

  it("defaults to km when no unit is given", () => {
    const plan = createPlanFromTemplate(db, "5k-to-10k", "2026-07-15");
    const id = plan.sessions[0].id;
    const done = completeSession(db, id, { distance: 10 });
    const stored = JSON.parse(done.actual_metrics!);
    expect(stored.distance_km).toBe(10);
    expect(stored.distance_unit).toBe("km");
  });

  it("deletes a plan and cascades its sessions", () => {
    const plan = createPlanFromTemplate(db, "couch-to-5k", "2026-07-15");
    expect(deletePlan(db, plan.id)).toBe(true);
    expect(listPlans(db).length).toBe(0);
    expect(getPlan(db, plan.id)).toBeUndefined();
    const orphans = db.prepare("SELECT COUNT(*) AS n FROM training_plan_sessions").get() as { n: number };
    expect(orphans.n).toBe(0);
  });
});
