import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { isValidDate } from "@/lib/daily-logs";
import { addSymptomEntry, listSymptomEntriesByDate } from "@/lib/symptoms";
import { todayISO } from "@/lib/date";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/symptoms?date=YYYY-MM-DD -> entries for that date (defaults to today).
export function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date") ?? todayISO();
  if (!isValidDate(date)) {
    return NextResponse.json(
      { error: "Invalid date. Expected format YYYY-MM-DD." },
      { status: 400 }
    );
  }
  return NextResponse.json(listSymptomEntriesByDate(getDb(), date));
}

// POST /api/symptoms { date?, conditionId, severity, notes? } -> create an entry.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const entry = addSymptomEntry(getDb(), {
      date: body.date,
      conditionId: Number(body.conditionId),
      severity: Number(body.severity),
      notes: body.notes ?? null,
    });
    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
