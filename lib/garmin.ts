import crypto from "node:crypto";
import type { DB } from "./db";
import type { WearablePartial } from "./wearables";
import { isValidDate } from "./daily-logs";

// --- Endpoints (override via env; confirm against Garmin's developer portal) ---
export const GARMIN_AUTH_URL = process.env.GARMIN_AUTH_URL ?? "https://connect.garmin.com/oauth2Confirm";
export const GARMIN_TOKEN_URL = process.env.GARMIN_TOKEN_URL ?? "https://diauth.garmin.com/di-oauth2-service/oauth/token";
export const GARMIN_API_BASE = process.env.GARMIN_API_BASE ?? "https://apis.garmin.com";

// ---------------------------------------------------------------------------
// PKCE
// ---------------------------------------------------------------------------

/** RFC 7636 code verifier: 43-128 chars of unreserved URL-safe characters. */
export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url"); // 43 chars
}

/** code_challenge = base64url(SHA-256(verifier)). */
export function codeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

export function buildAuthorizeUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
  challenge: string;
  scope?: string;
}): string {
  const u = new URL(GARMIN_AUTH_URL);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", opts.clientId);
  u.searchParams.set("redirect_uri", opts.redirectUri);
  u.searchParams.set("state", opts.state);
  u.searchParams.set("code_challenge", opts.challenge);
  u.searchParams.set("code_challenge_method", "S256");
  if (opts.scope) u.searchParams.set("scope", opts.scope);
  return u.toString();
}

// ---------------------------------------------------------------------------
// Payload normalizers (Garmin Health API JSON -> partial wearable_metrics)
// Field names follow Garmin's Health API spec; this is the one place to correct
// them if a real payload differs. Missing fields are simply omitted (not zeroed).
// ---------------------------------------------------------------------------

export interface NormalizedMetrics extends WearablePartial {
  date: string;
}

/** Non-negative integer or undefined (Garmin uses negatives like -1 for "no data"). */
function nonNegInt(v: unknown): number | undefined {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return undefined;
  return Math.round(v);
}

function assign(target: WearablePartial, key: keyof WearablePartial, v: number | undefined): void {
  if (v !== undefined) (target[key] as number) = v;
}

export function normalizeDailySummary(payload: Record<string, unknown>): NormalizedMetrics | null {
  const date = String(payload.calendarDate ?? "");
  if (!isValidDate(date)) return null;
  const out: NormalizedMetrics = { date };
  assign(out, "steps", nonNegInt(payload.steps));
  assign(out, "calories_active", nonNegInt(payload.activeKilocalories));
  assign(out, "calories_resting", nonNegInt(payload.bmrKilocalories));
  assign(out, "resting_hr", nonNegInt(payload.restingHeartRateInBeatsPerMinute));
  assign(out, "stress_avg", nonNegInt(payload.averageStressLevel));
  assign(out, "stress_max", nonNegInt(payload.maxStressLevel));
  return out;
}

export function normalizeSleep(payload: Record<string, unknown>): NormalizedMetrics | null {
  const date = String(payload.calendarDate ?? "");
  if (!isValidDate(date)) return null;
  const out: NormalizedMetrics = { date };
  const durationSec = nonNegInt(payload.durationInSeconds);
  if (durationSec !== undefined) out.sleep_minutes = Math.round(durationSec / 60);

  const stages: Record<string, number> = {};
  const stageMap: Array<[string, string]> = [
    ["deep", "deepSleepDurationInSeconds"],
    ["light", "lightSleepDurationInSeconds"],
    ["rem", "remSleepInSeconds"],
    ["awake", "awakeDurationInSeconds"],
  ];
  for (const [k, field] of stageMap) {
    const v = nonNegInt(payload[field]);
    if (v !== undefined) stages[k] = v;
  }
  if (Object.keys(stages).length > 0) out.sleep_stages = JSON.stringify(stages);
  return out;
}

export function normalizeStressDetails(payload: Record<string, unknown>): NormalizedMetrics | null {
  const date = String(payload.calendarDate ?? "");
  if (!isValidDate(date)) return null;
  const out: NormalizedMetrics = { date };
  const bb = payload.timeOffsetBodyBatteryValues;
  if (bb && typeof bb === "object") {
    const vals = Object.values(bb as Record<string, unknown>)
      .map((v) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined))
      .filter((v): v is number => v !== undefined);
    if (vals.length > 0) {
      out.body_battery_high = Math.round(Math.max(...vals));
      out.body_battery_low = Math.round(Math.min(...vals));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Token + PKCE-state storage (single-user)
// ---------------------------------------------------------------------------

export interface GarminTokens {
  access_token: string;
  refresh_token: string | null;
  token_type: string | null;
  scope: string | null;
  expires_at: string | null;
}

export function saveTokens(db: DB, t: GarminTokens): void {
  db.prepare(
    `INSERT INTO garmin_tokens (id, access_token, refresh_token, token_type, scope, expires_at, updated_at)
     VALUES (1, @access_token, @refresh_token, @token_type, @scope, @expires_at, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       access_token=excluded.access_token, refresh_token=excluded.refresh_token,
       token_type=excluded.token_type, scope=excluded.scope,
       expires_at=excluded.expires_at, updated_at=datetime('now')`
  ).run({
    access_token: t.access_token,
    refresh_token: t.refresh_token ?? null,
    token_type: t.token_type ?? null,
    scope: t.scope ?? null,
    expires_at: t.expires_at ?? null,
  });
}

export function getTokens(db: DB): (GarminTokens & { updated_at: string }) | undefined {
  return db.prepare("SELECT access_token, refresh_token, token_type, scope, expires_at, updated_at FROM garmin_tokens WHERE id = 1").get() as
    | (GarminTokens & { updated_at: string })
    | undefined;
}

export function clearTokens(db: DB): void {
  db.prepare("DELETE FROM garmin_tokens WHERE id = 1").run();
}

export function isConnected(db: DB): boolean {
  return !!getTokens(db);
}

export function savePkceState(db: DB, state: string, verifier: string): void {
  db.prepare("INSERT OR REPLACE INTO garmin_oauth_state (state, code_verifier) VALUES (?, ?)").run(state, verifier);
}

/** Read + delete the verifier for a state (one-time use). */
export function consumePkceState(db: DB, state: string): string | undefined {
  const row = db.prepare("SELECT code_verifier FROM garmin_oauth_state WHERE state = ?").get(state) as
    | { code_verifier: string }
    | undefined;
  if (row) db.prepare("DELETE FROM garmin_oauth_state WHERE state = ?").run(state);
  return row?.code_verifier;
}

// ---------------------------------------------------------------------------
// Live HTTP to Garmin (network; not exercised by unit tests)
// ---------------------------------------------------------------------------

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}. Set it in .env.local (see .env.example).`);
  return v;
}

export async function exchangeCodeForTokens(code: string, verifier: string): Promise<GarminTokens> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    code_verifier: verifier,
    client_id: requiredEnv("GARMIN_CLIENT_ID"),
    client_secret: requiredEnv("GARMIN_CLIENT_SECRET"),
    redirect_uri: requiredEnv("GARMIN_REDIRECT_URI"),
  });
  const res = await fetch(GARMIN_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Garmin token exchange failed: ${res.status} ${await res.text()}`);
  const j = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    token_type?: string;
    scope?: string;
    expires_in?: number;
  };
  const expires_at = j.expires_in ? new Date(Date.now() + j.expires_in * 1000).toISOString() : null;
  return {
    access_token: j.access_token,
    refresh_token: j.refresh_token ?? null,
    token_type: j.token_type ?? "Bearer",
    scope: j.scope ?? null,
    expires_at,
  };
}

/** Ask Garmin to backfill the last `days` days; it pushes the history to the webhooks. */
export async function triggerBackfill(accessToken: string, days = 30): Promise<void> {
  const end = Math.floor(Date.now() / 1000);
  const start = end - days * 86400;
  const q = `?summaryStartTimeInSeconds=${start}&summaryEndTimeInSeconds=${end}`;
  const types = ["dailies", "sleeps", "stressDetails"];
  for (const type of types) {
    await fetch(`${GARMIN_API_BASE}/wellness-api/rest/backfill/${type}${q}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }
}
