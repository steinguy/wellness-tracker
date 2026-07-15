import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getOrCreateDailyLog, isValidDate } from "@/lib/daily-logs";
import { todayISO } from "@/lib/date";

// better-sqlite3 is a native module: force the Node.js runtime, not Edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/daily-logs?date=YYYY-MM-DD
// Returns the daily_log for that date, creating it if it does not exist.
// Defaults to today when no date is supplied.
export function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date") ?? todayISO();

  if (!isValidDate(date)) {
    return NextResponse.json(
      { error: "Invalid date. Expected format YYYY-MM-DD." },
      { status: 400 }
    );
  }

  const log = getOrCreateDailyLog(getDb(), date);
  return NextResponse.json(log);
}
