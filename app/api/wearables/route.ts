import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { isValidDate } from "@/lib/daily-logs";
import { getWearableMetricsByDate } from "@/lib/wearables";
import { todayISO } from "@/lib/date";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/wearables?date=YYYY-MM-DD -> metrics for that date (defaults to today).
export function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date") ?? todayISO();
  if (!isValidDate(date)) {
    return NextResponse.json({ error: "Invalid date. Expected YYYY-MM-DD." }, { status: 400 });
  }
  return NextResponse.json(getWearableMetricsByDate(getDb(), date));
}
