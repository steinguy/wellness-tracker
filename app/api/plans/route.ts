import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { listPlans, createPlanFromTemplate } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(listPlans(getDb()));
}

// POST /api/plans { templateKey, startDate } -> generate a plan + sessions.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const plan = createPlanFromTemplate(getDb(), String(body.templateKey), String(body.startDate));
    return NextResponse.json(plan, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
