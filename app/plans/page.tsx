import Link from "next/link";
import { getDb } from "@/lib/db";
import { listPlans, getPlan, type PlanWithSessions } from "@/lib/plans";
import { PLAN_TEMPLATES } from "@/lib/plan-templates";
import { todayISO } from "@/lib/date";
import PlanManager from "@/app/components/PlanManager";

export const dynamic = "force-dynamic";

export default function PlansPage() {
  const db = getDb();
  const templates = PLAN_TEMPLATES.map((t) => ({
    key: t.key,
    name: t.name,
    goal: t.goal,
    durationWeeks: t.durationWeeks,
    sessionCount: t.sessions.length,
  }));
  const plans: PlanWithSessions[] = listPlans(db).map((p) => getPlan(db, p.id)!);

  return (
    <main className="mx-auto max-w-2xl p-8">
      <Link href="/" className="text-sm text-blue-600 hover:underline">&larr; Back to tracker</Link>
      <h1 className="mt-2 text-2xl font-semibold">Training plans</h1>
      <PlanManager today={todayISO()} templates={templates} plans={plans} />
    </main>
  );
}
