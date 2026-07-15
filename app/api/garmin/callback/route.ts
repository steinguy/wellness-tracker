import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { consumePkceState, exchangeCodeForTokens, saveTokens, triggerBackfill } from "@/lib/garmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/garmin/callback?code=&state=  -> exchange code, save tokens, backfill.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const code = sp.get("code");
  const state = sp.get("state");
  if (!code || !state) return NextResponse.redirect(new URL("/?garmin=error", req.url));

  const db = getDb();
  const verifier = consumePkceState(db, state);
  if (!verifier) return NextResponse.redirect(new URL("/?garmin=state_mismatch", req.url));

  try {
    const tokens = await exchangeCodeForTokens(code, verifier);
    saveTokens(db, tokens);
    // Fire-and-forget: Garmin pushes the 30-day history to our webhooks.
    triggerBackfill(tokens.access_token).catch(() => {});
    return NextResponse.redirect(new URL("/?garmin=connected", req.url));
  } catch {
    return NextResponse.redirect(new URL("/?garmin=error", req.url));
  }
}
