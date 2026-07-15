import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { isValidDate } from "@/lib/daily-logs";
import { addDays, todayISO } from "@/lib/date";
import {
  getDailySeries,
  listWearableSources,
  correlate,
  METRIC_KEYS,
  type Correlation,
} from "@/lib/trends";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/trends?start=&end=&conditionId=&source=
export function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const end = sp.get("end") ?? todayISO();
  const start = sp.get("start") ?? addDays(end, -29);
  if (!isValidDate(start) || !isValidDate(end)) {
    return NextResponse.json({ error: "Invalid date range (YYYY-MM-DD)." }, { status: 400 });
  }

  const conditionParam = sp.get("conditionId");
  const conditionId =
    conditionParam && conditionParam !== "all" ? Number(conditionParam) : undefined;
  const source = sp.get("source") ?? undefined;

  const db = getDb();
  const series = getDailySeries(db, { start, end, conditionId, source });
  const sources = listWearableSources(db);

  const correlations: Record<string, { avg: Correlation; max: Correlation }> = {};
  for (const m of METRIC_KEYS) {
    correlations[m] = {
      avg: correlate(series, m, "severity_avg"),
      max: correlate(series, m, "severity_max"),
    };
  }

  return NextResponse.json({ start, end, source: source ?? sources[0] ?? "csv", series, sources, correlations });
}
