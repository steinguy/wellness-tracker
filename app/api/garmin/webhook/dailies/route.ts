import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { mergeUpsertWearableMetrics } from "@/lib/wearables";
import { normalizeDailySummary } from "@/lib/garmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Garmin push: { "dailies": [ {...}, ... ] }. Respond 200 fast; skip bad items.
export async function POST(req: NextRequest) {
  const db = getDb();
  try {
    const body = await req.json();
    const items: Array<Record<string, unknown>> = Array.isArray(body) ? body : body.dailies ?? [];
    for (const item of items) {
      try {
        const n = normalizeDailySummary(item);
        if (n) {
          const { date, ...fields } = n;
          mergeUpsertWearableMetrics(db, "garmin", date, fields);
        }
      } catch {
        /* skip a single malformed item */
      }
    }
  } catch {
    /* ignore body parse errors — still ack */
  }
  return NextResponse.json({ ok: true });
}
