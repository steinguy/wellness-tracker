import { getDb } from "@/lib/db";
import { getOrCreateDailyLog } from "@/lib/daily-logs";
import { listConditions, seedDefaultConditions } from "@/lib/conditions";
import { listSymptomEntriesByDate } from "@/lib/symptoms";
import { todayISO } from "@/lib/date";
import SymptomTracker from "@/app/components/SymptomTracker";

// Read/write SQLite on each request; never statically prerender this page.
export const dynamic = "force-dynamic";

export default function Home() {
  const db = getDb();
  const today = todayISO();

  // Foundation from spec 01: ensure today's daily_log exists.
  const log = getOrCreateDailyLog(db, today);

  // Spec 02: make sure starter conditions exist, then load today's data.
  seedDefaultConditions(db);
  const conditions = listConditions(db);
  const entries = listSymptomEntriesByDate(db, today);

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold">Wellness &amp; Fitness Tracker</h1>
      <p className="mt-1 text-sm text-gray-500">
        {today} &middot; daily log #{log.id}
      </p>

      <SymptomTracker today={today} conditions={conditions} initialEntries={entries} />
    </main>
  );
}
