// Code-defined training-plan templates. Starting a plan copies these into
// training_plans / training_plan_sessions rows (see lib/plans.ts).

export interface TemplateSession {
  dayOffset: number; // days from the plan's start_date
  workoutType: string;
  targetMetrics: Record<string, unknown>;
}

export interface PlanTemplate {
  key: string;
  name: string;
  goal: string;
  durationWeeks: number;
  sessions: TemplateSession[];
}

// 3 sessions/week on day 0,2,4 of each week.
const WEEK_DAYS = [0, 2, 4];
function weekly(week: number, i: number): number {
  return week * 7 + WEEK_DAYS[i];
}

// ---- Couch to 5K: 9 weeks, run/walk intervals progressing to a 30-min run ----
const C25K_WEEKS: string[] = [
  "Brisk 5-min warm-up walk, then alternate 60s jog / 90s walk for 20 min.",
  "Warm-up walk, then alternate 90s jog / 2-min walk for 20 min.",
  "Warm-up walk, then 2× (90s jog, 90s walk, 3-min jog, 3-min walk).",
  "Warm-up walk, then 3-min jog / 90s walk / 5-min jog / 2.5-min walk / 3-min jog / 90s walk / 5-min jog.",
  "Warm-up walk, then 5-min jog / 3-min walk / 5-min jog / 3-min walk / 5-min jog.",
  "Warm-up walk, then 5-min jog / 3-min walk / 8-min jog / 3-min walk / 5-min jog.",
  "Warm-up walk, then jog 25 min continuously.",
  "Warm-up walk, then jog 28 min continuously.",
  "Warm-up walk, then jog 30 min continuously (~5K).",
];
function couchTo5k(): TemplateSession[] {
  const s: TemplateSession[] = [];
  C25K_WEEKS.forEach((desc, w) => {
    for (let i = 0; i < 3; i++) {
      s.push({
        dayOffset: weekly(w, i),
        workoutType: "Run/walk",
        targetMetrics: { week: w + 1, session: i + 1, plan: desc },
      });
    }
  });
  return s;
}

// ---- Beginner Strength: 8 weeks, full-body 3×/week, progressive sets×reps ----
const STRENGTH_EXERCISES = ["Squat", "Hinge (deadlift/RDL)", "Push (bench/press)", "Row", "Core"];
function beginnerStrength(): TemplateSession[] {
  // sets×reps ramp roughly by week
  const scheme = [
    { sets: 2, reps: 10 },
    { sets: 3, reps: 10 },
    { sets: 3, reps: 8 },
    { sets: 3, reps: 8 },
    { sets: 4, reps: 8 },
    { sets: 4, reps: 6 },
    { sets: 4, reps: 6 },
    { sets: 5, reps: 5 },
  ];
  const s: TemplateSession[] = [];
  scheme.forEach((sc, w) => {
    for (let i = 0; i < 3; i++) {
      s.push({
        dayOffset: weekly(w, i),
        workoutType: "Full-body strength",
        targetMetrics: {
          week: w + 1,
          session: i + 1,
          sets: sc.sets,
          reps: sc.reps,
          exercises: STRENGTH_EXERCISES,
        },
      });
    }
  });
  return s;
}

// ---- 5K to 10K: 6 weeks, 3 runs/week building distance ----
const TEN_K_WEEKS: Array<[number, number, number]> = [
  // [easy_km, tempo_km, long_km]
  [4, 4, 6],
  [4, 5, 7],
  [5, 5, 8],
  [5, 6, 8.5],
  [6, 6, 9.5],
  [5, 4, 10],
];
function fiveToTenK(): TemplateSession[] {
  const labels = ["Easy run", "Tempo run", "Long run"];
  const s: TemplateSession[] = [];
  TEN_K_WEEKS.forEach((dists, w) => {
    dists.forEach((km, i) => {
      s.push({
        dayOffset: weekly(w, i),
        workoutType: labels[i],
        targetMetrics: { week: w + 1, session: i + 1, distance_km: km },
      });
    });
  });
  return s;
}

export const PLAN_TEMPLATES: PlanTemplate[] = [
  {
    key: "couch-to-5k",
    name: "Couch to 5K",
    goal: "Build up to running 5K continuously",
    durationWeeks: 9,
    sessions: couchTo5k(),
  },
  {
    key: "beginner-strength",
    name: "Beginner Strength 3×/week",
    goal: "Establish a full-body strength base",
    durationWeeks: 8,
    sessions: beginnerStrength(),
  },
  {
    key: "5k-to-10k",
    name: "5K to 10K",
    goal: "Progress from 5K to running 10K",
    durationWeeks: 6,
    sessions: fiveToTenK(),
  },
];

export function getTemplate(key: string): PlanTemplate | undefined {
  return PLAN_TEMPLATES.find((t) => t.key === key);
}
