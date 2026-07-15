import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import {
  generateCodeVerifier,
  codeChallenge,
  buildAuthorizeUrl,
  normalizeDailySummary,
  normalizeSleep,
  normalizeStressDetails,
} from "./garmin";

describe("PKCE", () => {
  it("code challenge equals base64url(SHA-256(verifier))", () => {
    const verifier = "abc123_test-verifier";
    const expected = crypto.createHash("sha256").update(verifier).digest("base64url");
    expect(codeChallenge(verifier)).toBe(expected);
  });
  it("generated verifier is URL-safe and 43-128 chars", () => {
    const v = generateCodeVerifier();
    expect(v.length).toBeGreaterThanOrEqual(43);
    expect(v.length).toBeLessThanOrEqual(128);
    expect(v).toMatch(/^[A-Za-z0-9\-_]+$/);
  });
  it("builds an authorize URL with PKCE params", () => {
    const url = new URL(
      buildAuthorizeUrl({ clientId: "cid", redirectUri: "https://x/cb", state: "s1", challenge: "chal" })
    );
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("cid");
    expect(url.searchParams.get("code_challenge")).toBe("chal");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("state")).toBe("s1");
  });
});

describe("Garmin normalizers", () => {
  it("maps a daily summary keyed by calendarDate", () => {
    const n = normalizeDailySummary({
      calendarDate: "2026-07-14",
      steps: 9210,
      activeKilocalories: 512,
      bmrKilocalories: 1680,
      restingHeartRateInBeatsPerMinute: 56,
      averageStressLevel: 34,
      maxStressLevel: 88,
    })!;
    expect(n.date).toBe("2026-07-14");
    expect(n.steps).toBe(9210);
    expect(n.calories_active).toBe(512);
    expect(n.calories_resting).toBe(1680);
    expect(n.resting_hr).toBe(56);
    expect(n.stress_avg).toBe(34);
    expect(n.stress_max).toBe(88);
  });

  it("omits missing/negative fields instead of zeroing them", () => {
    const n = normalizeDailySummary({ calendarDate: "2026-07-14", steps: 100, averageStressLevel: -1 })!;
    expect(n.steps).toBe(100);
    expect("calories_active" in n).toBe(false);
    expect("stress_avg" in n).toBe(false); // -1 = "no data"
  });

  it("returns null for a bad/missing calendarDate", () => {
    expect(normalizeDailySummary({ steps: 100 })).toBeNull();
    expect(normalizeDailySummary({ calendarDate: "07/14/2026" })).toBeNull();
  });

  it("converts sleep duration to minutes and captures stages", () => {
    const n = normalizeSleep({
      calendarDate: "2026-07-14",
      durationInSeconds: 26400,
      deepSleepDurationInSeconds: 6000,
      lightSleepDurationInSeconds: 15000,
      remSleepInSeconds: 4200,
      awakeDurationInSeconds: 1200,
    })!;
    expect(n.date).toBe("2026-07-14");
    expect(n.sleep_minutes).toBe(440); // 26400 / 60
    expect(JSON.parse(n.sleep_stages!)).toMatchObject({ deep: 6000, light: 15000, rem: 4200, awake: 1200 });
  });

  it("derives Body Battery high/low from stress-detail samples", () => {
    const n = normalizeStressDetails({
      calendarDate: "2026-07-14",
      timeOffsetBodyBatteryValues: { "0": 42, "900": 55, "1800": 61, "2700": 38 },
    })!;
    expect(n.body_battery_high).toBe(61);
    expect(n.body_battery_low).toBe(38);
  });
});
