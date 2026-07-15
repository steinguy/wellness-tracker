import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { updateSymptomEntry, deleteSymptomEntry } from "@/lib/symptoms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseId(param: string): number | null {
  const id = Number(param);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// PATCH /api/symptoms/[id] { conditionId?, severity?, notes? } -> edit an entry.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseId(params.id);
  if (id === null) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }
  try {
    const body = await req.json();
    const patch: Record<string, unknown> = {};
    if (body.conditionId !== undefined) patch.conditionId = Number(body.conditionId);
    if (body.severity !== undefined) patch.severity = Number(body.severity);
    if (body.notes !== undefined) patch.notes = body.notes;
    const entry = updateSymptomEntry(getDb(), id, patch);
    return NextResponse.json(entry);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

// DELETE /api/symptoms/[id] -> remove an entry.
export function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseId(params.id);
  if (id === null) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }
  const removed = deleteSymptomEntry(getDb(), id);
  if (!removed) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
