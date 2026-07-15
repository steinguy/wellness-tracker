import type { DB } from "./db";
import { isValidDate } from "./daily-logs";
import { addDays } from "./date";
import { getTemplate } from "./plan-templates";

export interface TrainingPlan {
  id: number;
  name: string;
  goal: string | null;
  start_date: string;
  generated_by: string;
  template_key: string | null;
  created_at: string;
}

export interface TrainingPlanSession {
  id: number;
  training_plan_id: number;
  scheduled_date: string;
  workout_type: string;
  target_metrics: string | null; // JSON text
  completed: number; // 0 | 1
  actual_metrics: string | null; // JSON text
  completed_at: string | null;
}

export interface PlanWithSessions extends TrainingPlan {
  sessions: TrainingPlanSession[];
}

export type DistanceUnit = "km" | "mi";

const MI_TO_KM = 1.609344;

/** Input shape for recording a completed session's actual metrics. */
export interface SessionActuals {
  duration_min?: number;
  distance?: number; // in `distance_unit`
  distance_unit?: DistanceUnit; // defaults to "km"
  rpe?: number; // 1-10 perceived exertion
  notes?: string;
}

/** Stored (canonical) shape written to actual_metrics JSON. */
export interface StoredActuals {
  duration_min?: number;
  distance_km?: number; // always canonical km
  distance_unit?: DistanceUnit; // the unit the user entered, for display
  rpe?: number;
  notes?: string;
}

/** Validate + normalize actuals: distance is converted to canonical km, unit remembered. */
function validateActuals(a: SessionActuals): StoredActuals {
  const out: StoredActuals = {};
  const num = (v: unknown, field: string, max?: number) => {
    if (v === undefined || v === null || v === "") return undefined;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) throw new Error(`"${field}" must be a non-negative number.`);
    if (max !== undefined && n > max) throw new Error(`"${field}" must be <= ${max}.`);
    return n;
  };

  const dur = num(a.duration_min, "duration_min");
  const dist = num(a.distance, "distance");
  const rpe = num(a.rpe, "rpe", 10);
  if (rpe !== undefined && rpe < 1) throw new Error(`"rpe" must be between 1 and 10.`);

  let unit: DistanceUnit = "km";
  if (a.distance_unit !== undefined && a.distance_unit !== null) {
    if (a.distance_unit !== "km" && a.distance_unit !== "mi") {
      throw new Error(`"distance_unit" must be "km" or "mi".`);
    }
    unit = a.distance_unit;
  }

  if (dur !== undefined) out.duration_min = dur;
  if (dist !== undefined) {
    const km = unit === "mi" ? dist * MI_TO_KM : dist;
    out.distance_km = Math.round(km * 10000) / 10000; // canonical km, trimmed drift
    out.distance_unit = unit;
  }
  if (rpe !== undefined) out.rpe = rpe;
  if (a.notes !== undefined && a.notes !== null && String(a.notes).trim() !== "") {
    out.notes = String(a.notes);
  }
  return out;
}

/** Generate a plan (and its sessions) from a code-defined template. */
export function createPlanFromTemplate(
  db: DB,
  templateKey: string,
  startDate: string
): PlanWithSessions {
  const template = getTemplate(templateKey);
  if (!template) throw new Error(`Unknown template: "${templateKey}".`);
  if (!isValidDate(startDate)) {
    throw new Error(`Invalid start date: "${startDate}". Expected YYYY-MM-DD.`);
  }

  const create = db.transaction(() => {
    const planInfo = db
      .prepare(
        `INSERT INTO training_plans (name, goal, start_date, generated_by, template_key)
         VALUES (?, ?, ?, 'template', ?)`
      )
      .run(template.name, template.goal, startDate, template.key);
    const planId = Number(planInfo.lastInsertRowid);

    const insertSession = db.prepare(
      `INSERT INTO training_plan_sessions (training_plan_id, scheduled_date, workout_type, target_metrics)
       VALUES (?, ?, ?, ?)`
    );
    for (const s of template.sessions) {
      insertSession.run(
        planId,
        addDays(startDate, s.dayOffset),
        s.workoutType,
        JSON.stringify(s.targetMetrics)
      );
    }
    return planId;
  });

  return getPlan(db, create())!;
}

export function listPlans(db: DB): TrainingPlan[] {
  return db
    .prepare("SELECT * FROM training_plans ORDER BY start_date DESC, id DESC")
    .all() as TrainingPlan[];
}

export function getPlan(db: DB, id: number): PlanWithSessions | undefined {
  const plan = db.prepare("SELECT * FROM training_plans WHERE id = ?").get(id) as
    | TrainingPlan
    | undefined;
  if (!plan) return undefined;
  const sessions = db
    .prepare(
      "SELECT * FROM training_plan_sessions WHERE training_plan_id = ? ORDER BY scheduled_date, id"
    )
    .all(id) as TrainingPlanSession[];
  return { ...plan, sessions };
}

export function deletePlan(db: DB, id: number): boolean {
  return db.prepare("DELETE FROM training_plans WHERE id = ?").run(id).changes > 0;
}

export function getSession(db: DB, id: number): TrainingPlanSession | undefined {
  return db
    .prepare("SELECT * FROM training_plan_sessions WHERE id = ?")
    .get(id) as TrainingPlanSession | undefined;
}

/** Mark a session done, recording validated actual metrics. */
export function completeSession(
  db: DB,
  id: number,
  actuals: SessionActuals = {}
): TrainingPlanSession {
  if (!getSession(db, id)) throw new Error(`Unknown session id: ${id}.`);
  const clean = validateActuals(actuals);
  db.prepare(
    "UPDATE training_plan_sessions SET completed = 1, actual_metrics = ?, completed_at = datetime('now') WHERE id = ?"
  ).run(JSON.stringify(clean), id);
  return getSession(db, id)!;
}

/** Revert a session to not-done, clearing actuals + timestamp. */
export function uncompleteSession(db: DB, id: number): TrainingPlanSession {
  if (!getSession(db, id)) throw new Error(`Unknown session id: ${id}.`);
  db.prepare(
    "UPDATE training_plan_sessions SET completed = 0, actual_metrics = NULL, completed_at = NULL WHERE id = ?"
  ).run(id);
  return getSession(db, id)!;
}
