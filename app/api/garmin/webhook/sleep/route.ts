import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { mergeUpsertWearableMetrics } from "@/lib/wearables";
import { normalizeSleep } from "@/lib/garmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Garmin push: { "sleeps": [ {...}, ... ] }.
export async function POST(req: NextRequest) {
  const db = getDb();
  try {
    const body = await req.json();
    const items: Array<Record<string, unknown>> = Array.isArray(body) ? body : body.sleeps ?? [];
    for (const item of items) {
      try {
        const n = normalizeSleep(item);
        if (n) {
          const { date, ...fields } = n;
          mergeUpsertWearableMetrics(db, "garmin", date, fields);
        }
      } catch {
        /* skip */
      }
    }
  } catch {
    /* ack anyway */
  }
  return NextResponse.json({ ok: true });
}
