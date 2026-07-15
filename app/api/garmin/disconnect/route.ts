import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { clearTokens } from "@/lib/garmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST() {
  clearTokens(getDb());
  return NextResponse.json({ ok: true });
}
