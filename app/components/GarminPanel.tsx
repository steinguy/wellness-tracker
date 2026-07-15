"use client";

import { useEffect, useState } from "react";

interface Status {
  configured: boolean;
  connected: boolean;
  expires_at: string | null;
  updated_at: string | null;
}

export default function GarminPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    fetch("/api/garmin/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus(null));

  useEffect(() => {
    load();
  }, []);

  // Surface the callback result from the URL (?garmin=connected|error|state_mismatch).
  const banner =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("garmin") : null;

  async function disconnect() {
    setBusy(true);
    await fetch("/api/garmin/disconnect", { method: "POST" });
    await load();
    setBusy(false);
  }

  return (
    <section className="mt-10">
      <h2 className="text-lg font-medium">Garmin sync</h2>
      <div className="mt-3 rounded-lg border border-gray-200 bg-white p-4 text-sm">
        {banner === "connected" && <p className="mb-2 text-green-700">Garmin connected — a 30-day backfill was requested.</p>}
        {banner === "error" && <p className="mb-2 text-red-600">Garmin connection failed. Check your app credentials.</p>}
        {banner === "state_mismatch" && <p className="mb-2 text-red-600">Auth state mismatch — please try connecting again.</p>}

        {!status ? (
          <p className="text-gray-500">Checking status…</p>
        ) : !status.configured ? (
          <p className="text-gray-600">
            Garmin isn&rsquo;t configured yet. Set <code>GARMIN_CLIENT_ID</code>, <code>GARMIN_CLIENT_SECRET</code>,
            and <code>GARMIN_REDIRECT_URI</code> (see <code>.env.example</code>), and register your webhook URLs in the
            Garmin developer portal.
          </p>
        ) : status.connected ? (
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium text-green-800">Connected</p>
              <p className="text-xs text-gray-500">
                {status.expires_at ? `Token expires ${status.expires_at}` : "Token stored"}
              </p>
            </div>
            <button onClick={disconnect} disabled={busy} className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50">
              Disconnect
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-gray-600">Not connected. Authorize Garmin to sync steps, calories, resting HR, stress, Body Battery, and sleep.</p>
            <a href="/api/garmin/connect" className="shrink-0 rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
              Connect Garmin
            </a>
          </div>
        )}
        <p className="mt-2 text-xs text-gray-400">
          Garmin pushes data to <code>/api/garmin/webhook/*</code>, which need a public HTTPS URL (tunnel or deploy) to
          receive live syncs.
        </p>
      </div>
    </section>
  );
}
