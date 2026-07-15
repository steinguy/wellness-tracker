import { NextResponse } from "next/server";
import { PLAN_TEMPLATES } from "@/lib/plan-templates";

export const runtime = "nodejs";

// GET /api/plan-templates -> summaries of the code-defined templates.
export function GET() {
  return NextResponse.json(
    PLAN_TEMPLATES.map((t) => ({
      key: t.key,
      name: t.name,
      goal: t.goal,
      durationWeeks: t.durationWeeks,
      sessionCount: t.sessions.length,
    }))
  );
}
