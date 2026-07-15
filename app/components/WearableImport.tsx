"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface RowError { row: number; message: string; }
interface ImportSummary {
  imported: number;
  updated: number;
  skipped: number;
  errors: RowError[];
}

export default function WearableImport() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState("csv");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSummary(null);
    if (!file) {
      setError("Choose a CSV file first.");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("source", source);
      const res = await fetch("/api/wearables/import", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed.");
      setSummary(data as ImportSummary);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-3 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col text-sm">
          <span className="mb-1 text-gray-600">CSV file</span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
        </label>
        <label className="flex flex-col text-sm">
          <span className="mb-1 text-gray-600">Source label</span>
          <input
            type="text"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="w-32 rounded border border-gray-300 px-2 py-1"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? "Importing…" : "Import"}
        </button>
      </div>

      <p className="text-xs text-gray-500">
        Expected columns: <code>date</code> (YYYY-MM-DD, required), plus any of{" "}
        <code>steps</code>, <code>calories_active</code>, <code>calories_resting</code>,{" "}
        <code>sleep_minutes</code>, <code>resting_hr</code>, <code>sleep_stages</code>. Unknown columns are ignored.
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {summary && (
        <div className="rounded border border-green-200 bg-green-50 p-3 text-sm">
          <p className="font-medium text-green-800">
            {summary.imported} imported · {summary.updated} updated · {summary.skipped} skipped
          </p>
          {summary.errors.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-red-700">
              {summary.errors.map((er) => (
                <li key={er.row}>Row {er.row}: {er.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
