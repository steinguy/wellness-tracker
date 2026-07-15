"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface TemplateSummary {
  key: string;
  name: string;
  goal: string;
  durationWeeks: number;
  sessionCount: number;
}
interface Session {
  id: number;
  scheduled_date: string;
  workout_type: string;
  target_metrics: string | null;
  completed: number;
  actual_metrics: string | null;
  completed_at: string | null;
}
interface Plan {
  id: number;
  name: string;
  goal: string | null;
  start_date: string;
  template_key: string | null;
  sessions: Session[];
}

function formatTarget(json: string | null): string {
  if (!json) return "";
  try {
    const t = JSON.parse(json) as Record<string, unknown>;
    const label = t.week ? `W${t.week}·S${t.session} — ` : "";
    if (typeof t.plan === "string") return label + t.plan;
    if (t.distance_km !== undefined) return `${label}${t.distance_km} km`;
    if (t.sets !== undefined) return `${label}${t.sets}×${t.reps} — ${(t.exercises as string[])?.join(", ")}`;
    return label.trim();
  } catch {
    return "";
  }
}

function formatActuals(json: string | null): string {
  if (!json) return "";
  try {
    const a = JSON.parse(json) as Record<string, unknown>;
    const bits: string[] = [];
    if (a.duration_min !== undefined) bits.push(`${a.duration_min} min`);
    if (a.distance_km !== undefined) {
      const unit = a.distance_unit === "mi" ? "mi" : "km";
      const km = Number(a.distance_km);
      const val = unit === "mi" ? km / 1.609344 : km;
      bits.push(`${Math.round(val * 100) / 100} ${unit}`);
    }
    if (a.rpe !== undefined) bits.push(`Effort ${a.rpe}/10`);
    if (a.notes) bits.push(String(a.notes));
    return bits.join(" · ");
  } catch {
    return "";
  }
}

export default function PlanManager({
  today,
  templates,
  plans,
}: {
  today: string;
  templates: TemplateSummary[];
  plans: Plan[];
}) {
  const router = useRouter();
  const [templateKey, setTemplateKey] = useState(templates[0]?.key ?? "");
  const [startDate, setStartDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createPlan(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateKey, startDate }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to create plan.");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function deletePlan(id: number) {
    if (!confirm("Delete this plan and all its sessions?")) return;
    await fetch(`/api/plans/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="mt-6">
      <section>
        <h2 className="text-lg font-medium">Start a plan</h2>
        <form onSubmit={createPlan} className="mt-3 flex flex-wrap items-end gap-4 rounded-lg border border-gray-200 bg-white p-4">
          <label className="flex flex-col text-sm">
            <span className="mb-1 text-gray-600">Template</span>
            <select value={templateKey} onChange={(e) => setTemplateKey(e.target.value)} className="rounded border border-gray-300 px-2 py-1">
              {templates.map((t) => (
                <option key={t.key} value={t.key}>{t.name} · {t.durationWeeks}w · {t.sessionCount} sessions</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-sm">
            <span className="mb-1 text-gray-600">Start date</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded border border-gray-300 px-2 py-1" />
          </label>
          <button type="submit" disabled={busy || !templateKey} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {busy ? "Creating…" : "Create plan"}
          </button>
          {error && <p className="w-full text-sm text-red-600">{error}</p>}
        </form>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium">Your plans</h2>
        {plans.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No plans yet. Start one above.</p>
        ) : (
          <div className="mt-3 space-y-4">
            {plans.map((plan) => {
              const done = plan.sessions.filter((s) => s.completed).length;
              return (
                <div key={plan.id} className="rounded-lg border border-gray-200 bg-white p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium">{plan.name}</h3>
                      <p className="text-sm text-gray-500">{plan.goal}</p>
                      <p className="text-xs text-gray-400">
                        Starts {plan.start_date} · {done}/{plan.sessions.length} sessions done
                      </p>
                    </div>
                    <button onClick={() => deletePlan(plan.id)} className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50">Delete</button>
                  </div>
                  <ul className="mt-3 space-y-1">
                    {plan.sessions.map((s) => (
                      <SessionRow key={s.id} session={s} />
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function SessionRow({ session }: { session: Session }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [duration, setDuration] = useState("");
  const [distance, setDistance] = useState("");
  const [distanceUnit, setDistanceUnit] = useState<"km" | "mi">("km");
  const [rpe, setRpe] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDone = !!session.completed;

  async function markDone() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/plan-sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          completed: true,
          actuals: {
            duration_min: duration || undefined,
            distance: distance || undefined,
            distance_unit: distanceUnit,
            rpe: rpe || undefined,
            notes: notes || undefined,
          },
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed.");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    setBusy(true);
    await fetch(`/api/plan-sessions/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: false }),
    });
    router.refresh();
  }

  return (
    <li className={`rounded border p-2 text-sm ${isDone ? "border-green-200 bg-green-50" : "border-gray-200"}`}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <span className="font-medium">{session.scheduled_date}</span>{" "}
          <span className="text-gray-600">{session.workout_type}</span>
          <div className="text-xs text-gray-500">{formatTarget(session.target_metrics)}</div>
          {isDone && formatActuals(session.actual_metrics) && (
            <div className="text-xs text-green-700">Actual: {formatActuals(session.actual_metrics)}</div>
          )}
        </div>
        {isDone ? (
          <button onClick={undo} disabled={busy} className="shrink-0 rounded border border-gray-300 px-2 py-1 text-xs">Undo</button>
        ) : (
          <button onClick={() => setOpen((o) => !o)} className="shrink-0 rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700">Mark done</button>
        )}
      </div>
      {open && !isDone && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <input type="number" min="0" placeholder="min" value={duration} onChange={(e) => setDuration(e.target.value)} className="w-20 rounded border border-gray-300 px-2 py-1 text-xs" />
          <input type="number" min="0" step="0.1" placeholder="dist" value={distance} onChange={(e) => setDistance(e.target.value)} className="w-16 rounded border border-gray-300 px-2 py-1 text-xs" />
          <select value={distanceUnit} onChange={(e) => setDistanceUnit(e.target.value as "km" | "mi")} className="rounded border border-gray-300 px-1 py-1 text-xs">
            <option value="km">km</option>
            <option value="mi">mi</option>
          </select>
          <select value={rpe} onChange={(e) => setRpe(e.target.value)} title="Effort (1-10)" className="rounded border border-gray-300 px-1 py-1 text-xs">
            <option value="">Effort</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <input type="text" placeholder="notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="min-w-[8rem] flex-1 rounded border border-gray-300 px-2 py-1 text-xs" />
          <button onClick={markDone} disabled={busy} className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50">Save</button>
          {error && <p className="w-full text-xs text-red-600">{error}</p>}
        </div>
      )}
    </li>
  );
}
