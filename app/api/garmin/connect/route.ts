import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { generateCodeVerifier, codeChallenge, buildAuthorizeUrl, savePkceState } from "@/lib/garmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/garmin/connect -> start OAuth 2.0 PKCE, redirect to Garmin.
export function GET() {
  const clientId = process.env.GARMIN_CLIENT_ID;
  const redirectUri = process.env.GARMIN_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "Garmin not configured. Set GARMIN_CLIENT_ID and GARMIN_REDIRECT_URI (see .env.example)." },
      { status: 500 }
    );
  }
  const verifier = generateCodeVerifier();
  const state = crypto.randomBytes(16).toString("hex");
  savePkceState(getDb(), state, verifier);
  const url = buildAuthorizeUrl({
    clientId,
    redirectUri,
    state,
    challenge: codeChallenge(verifier),
    scope: process.env.GARMIN_SCOPE,
  });
  return NextResponse.redirect(url);
}
