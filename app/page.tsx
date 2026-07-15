import Link from "next/link";
import { getDb } from "@/lib/db";
import { getOrCreateDailyLog } from "@/lib/daily-logs";
import { listConditions, seedDefaultConditions } from "@/lib/conditions";
import { listSymptomEntriesByDate } from "@/lib/symptoms";
import { getWearableMetricsByDate } from "@/lib/wearables";
import { todayISO } from "@/lib/date";
import SymptomTracker from "@/app/components/SymptomTracker";
import WearableImport from "@/app/components/WearableImport";

// Read/write SQLite on each request; never statically prerender this page.
export const dynamic = "force-dynamic";

export default function Home() {
  const db = getDb();
  const today = todayISO();

  const log = getOrCreateDailyLog(db, today); // spec 01
  seedDefaultConditions(db); // spec 02
  const conditions = listConditions(db);
  const entries = listSymptomEntriesByDate(db, today);
  const metrics = getWearableMetricsByDate(db, today); // spec 03

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold">Wellness &amp; Fitness Tracker</h1>
      <p className="mt-1 text-sm text-gray-500">
        {today} &middot; daily log #{log.id}
      </p>
      <p className="mt-2 flex gap-4">
        <Link href="/plans" className="text-sm text-blue-600 hover:underline">Training plans &rarr;</Link>
        <Link href="/trends" className="text-sm text-blue-600 hover:underline">Trends &rarr;</Link>
      </p>

      <SymptomTracker today={today} conditions={conditions} initialEntries={entries} />

      <section className="mt-10">
        <h2 className="text-lg font-medium">Import wearable CSV</h2>
        <WearableImport />

        <h3 className="mt-6 text-sm font-medium text-gray-700">Today&rsquo;s wearable metrics</h3>
        {metrics.length === 0 ? (
          <p className="mt-1 text-sm text-gray-500">
            No wearable data for {today} yet. Import a CSV that includes this date.
          </p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {metrics.map((m) => (
              <li key={m.id} className="rounded border border-gray-200 bg-white p-2">
                <span className="font-medium">{m.source}</span>:{" "}
                {m.steps ?? "—"} steps · {m.sleep_minutes ?? "—"} min sleep ·{" "}
                resting HR {m.resting_hr ?? "—"} · stress {m.stress_avg ?? "—"} ·{" "}
                Body Battery {m.body_battery_low ?? "—"}–{m.body_battery_high ?? "—"} ·{" "}
                {(m.calories_active ?? 0) + (m.calories_resting ?? 0) || "—"} kcal
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
