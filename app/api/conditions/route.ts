import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { listConditions, createCondition, seedDefaultConditions } from "@/lib/conditions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/conditions -> list all conditions (seeding the starter set if empty).
export function GET() {
  const db = getDb();
  seedDefaultConditions(db);
  return NextResponse.json(listConditions(db));
}

// POST /api/conditions { name, tracked_fields? } -> create a condition.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const condition = createCondition(getDb(), body.name, body.tracked_fields);
    return NextResponse.json(condition, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
