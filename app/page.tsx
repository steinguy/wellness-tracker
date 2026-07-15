import { getDb } from "@/lib/db";
import { getOrCreateDailyLog } from "@/lib/daily-logs";
import { todayISO } from "@/lib/date";

// Read/write SQLite on each request; never statically prerender this page.
export const dynamic = "force-dynamic";

export default function Home() {
  const today = todayISO();
  const log = getOrCreateDailyLog(getDb(), today);

  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-2xl font-semibold">Wellness &amp; Fitness Tracker</h1>
      <p className="mt-2 text-gray-600">Today is {today}.</p>

      <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4">
        <p className="font-medium text-green-800">&#10003; Daily log ready</p>
        <p className="mt-1 text-sm text-green-700">
          A <code>daily_logs</code> row (#{log.id}) exists for {log.date},
          created at {log.created_at}.
        </p>
      </div>

      <p className="mt-6 text-sm text-gray-500">
        Stack check: Next.js + SQLite + Tailwind are wired end to end.
      </p>
    </main>
  );
}
