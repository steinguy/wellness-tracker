import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getPlan, deletePlan } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseId(p: string): number | null {
  const id = Number(p);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseId(params.id);
  if (id === null) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const plan = getPlan(getDb(), id);
  if (!plan) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json(plan);
}

export function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseId(params.id);
  if (id === null) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  return deletePlan(getDb(), id)
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "Not found." }, { status: 404 });
}
