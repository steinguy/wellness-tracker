import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { completeSession, uncompleteSession } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseId(p: string): number | null {
  const id = Number(p);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// PATCH /api/plan-sessions/[id] { completed: boolean, actuals?: {...} }
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseId(params.id);
  if (id === null) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  try {
    const body = await req.json();
    const session = body.completed
      ? completeSession(getDb(), id, body.actuals ?? {})
      : uncompleteSession(getDb(), id);
    return NextResponse.json(session);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
