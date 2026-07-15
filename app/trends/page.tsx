import Link from "next/link";
import { getDb } from "@/lib/db";
import { listConditions, seedDefaultConditions } from "@/lib/conditions";
import { listWearableSources } from "@/lib/trends";
import { addDays, todayISO } from "@/lib/date";
import TrendDashboard from "@/app/components/TrendDashboard";

export const dynamic = "force-dynamic";

export default function TrendsPage() {
  const db = getDb();
  seedDefaultConditions(db);
  const conditions = listConditions(db).map((c) => ({ id: c.id, name: c.name }));
  const sources = listWearableSources(db);
  const end = todayISO();
  const start = addDays(end, -29);

  return (
    <main className="mx-auto max-w-3xl p-8">
      <Link href="/" className="text-sm text-blue-600 hover:underline">&larr; Back to tracker</Link>
      <h1 className="mt-2 text-2xl font-semibold">Trends</h1>
      <p className="mt-1 text-sm text-gray-500">Symptom severity vs. wearable activity, and how they relate.</p>
      <TrendDashboard
        conditions={conditions}
        sources={sources}
        defaultStart={start}
        defaultEnd={end}
      />
    </main>
  );
}
