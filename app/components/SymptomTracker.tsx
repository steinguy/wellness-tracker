"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Condition {
  id: number;
  name: string;
}

interface SymptomEntry {
  id: number;
  condition_id: number;
  condition_name: string;
  severity: number;
  notes: string | null;
  logged_at: string;
}

export default function SymptomTracker({
  today,
  conditions,
  initialEntries,
}: {
  today: string;
  conditions: Condition[];
  initialEntries: SymptomEntry[];
}) {
  const router = useRouter();
  const [conditionId, setConditionId] = useState<number>(conditions[0]?.id ?? 0);
  const [severity, setSeverity] = useState<number>(5);
  const [notes, setNotes] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addEntry(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/symptoms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: today, conditionId, severity, notes }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to add entry.");
      setNotes("");
      setSeverity(5);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8">
      <h2 className="text-lg font-medium">Log a symptom</h2>

      <form onSubmit={addEntry} className="mt-3 space-y-3 rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col text-sm">
            <span className="mb-1 text-gray-600">Condition</span>
            <select
              value={conditionId}
              onChange={(e) => setConditionId(Number(e.target.value))}
              className="rounded border border-gray-300 px-2 py-1"
            >
              {conditions.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col text-sm">
            <span className="mb-1 text-gray-600">Severity: {severity}</span>
            <input
              type="range"
              min={1}
              max={10}
              value={severity}
              onChange={(e) => setSeverity(Number(e.target.value))}
            />
          </label>
        </div>

        <label className="flex flex-col text-sm">
          <span className="mb-1 text-gray-600">Notes (optional)</span>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="triggers, context, how it felt…"
            className="rounded border border-gray-300 px-2 py-1"
          />
        </label>

        <button
          type="submit"
          disabled={busy || conditions.length === 0}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Add entry"}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>

      <h2 className="mt-8 text-lg font-medium">Today&rsquo;s entries</h2>
      {initialEntries.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">No symptoms logged for {today} yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {initialEntries.map((entry) => (
            <EntryRow key={entry.id} entry={entry} conditions={conditions} />
          ))}
        </ul>
      )}
    </section>
  );
}

function EntryRow({ entry, conditions }: { entry: SymptomEntry; conditions: Condition[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [conditionId, setConditionId] = useState(entry.condition_id);
  const [severity, setSeverity] = useState(entry.severity);
  const [notes, setNotes] = useState(entry.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/symptoms/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conditionId, severity, notes }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to update.");
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this entry?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/symptoms/${entry.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to delete.");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <li className="rounded-lg border border-blue-200 bg-blue-50 p-3">
        <div className="flex flex-wrap items-end gap-3">
          <select
            value={conditionId}
            onChange={(e) => setConditionId(Number(e.target.value))}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          >
            {conditions.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <label className="text-sm text-gray-600">
            Severity: {severity}
            <input
              type="range"
              min={1}
              max={10}
              value={severity}
              onChange={(e) => setSeverity(Number(e.target.value))}
              className="ml-2 align-middle"
            />
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-w-[12rem] flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </div>
        <div className="mt-2 flex gap-2">
          <button onClick={save} disabled={busy} className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">Save</button>
          <button onClick={() => setEditing(false)} className="rounded border border-gray-300 px-2 py-1 text-xs">Cancel</button>
        </div>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3">
      <div>
        <span className="font-medium">{entry.condition_name}</span>{" "}
        <span className="text-sm text-gray-600">severity {entry.severity}/10</span>
        {entry.notes && <span className="text-sm text-gray-500"> — {entry.notes}</span>}
        <div className="text-xs text-gray-400">{entry.logged_at}</div>
      </div>
      <div className="flex shrink-0 gap-2">
        <button onClick={() => setEditing(true)} className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50">Edit</button>
        <button onClick={remove} disabled={busy} className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50">Delete</button>
      </div>
    </li>
  );
}
