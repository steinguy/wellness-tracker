import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getTokens } from "@/lib/garmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const t = getTokens(getDb());
  const configured = !!(process.env.GARMIN_CLIENT_ID && process.env.GARMIN_REDIRECT_URI);
  return NextResponse.json({
    configured,
    connected: !!t,
    expires_at: t?.expires_at ?? null,
    updated_at: t?.updated_at ?? null,
  });
}
