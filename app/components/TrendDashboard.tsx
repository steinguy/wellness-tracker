"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { interpretR, type MetricKey, type Correlation } from "@/lib/trends";

interface DailyPoint {
  date: string;
  severity_avg: number | null;
  severity_max: number | null;
  steps: number | null;
  sleep_minutes: number | null;
  resting_hr: number | null;
  stress_avg: number | null;
  body_battery_low: number | null;
}
interface TrendsResponse {
  start: string;
  end: string;
  source: string;
  series: DailyPoint[];
  sources: string[];
  correlations: Record<MetricKey, { avg: Correlation; max: Correlation }>;
}

const METRIC_LABELS: Record<MetricKey, string> = {
  steps: "Steps",
  sleep_minutes: "Sleep (min)",
  resting_hr: "Resting HR",
  stress_avg: "Stress (avg)",
  body_battery_low: "Body Battery (low)",
};

export default function TrendDashboard({
  conditions,
  sources,
  defaultStart,
  defaultEnd,
}: {
  conditions: Array<{ id: number; name: string }>;
  sources: string[];
  defaultStart: string;
  defaultEnd: string;
}) {
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  const [conditionId, setConditionId] = useState<string>("all");
  const [source, setSource] = useState<string>(sources[0] ?? "csv");
  const [metric, setMetric] = useState<MetricKey>("sleep_minutes");
  const [data, setData] = useState<TrendsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const params = new URLSearchParams({ start, end, conditionId, source });
    setLoading(true);
    fetch(`/api/trends?${params.toString()}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Failed to load trends.");
        return j as TrendsResponse;
      })
      .then((j) => {
        setData(j);
        setError(null);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [start, end, conditionId, source]);

  const hasData = data && data.series.length > 0;
  const corr = data?.correlations?.[metric];

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4 text-sm">
        <label className="flex flex-col">
          <span className="mb-1 text-gray-600">From</span>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="rounded border border-gray-300 px-2 py-1" />
        </label>
        <label className="flex flex-col">
          <span className="mb-1 text-gray-600">To</span>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="rounded border border-gray-300 px-2 py-1" />
        </label>
        <label className="flex flex-col">
          <span className="mb-1 text-gray-600">Condition</span>
          <select value={conditionId} onChange={(e) => setConditionId(e.target.value)} className="rounded border border-gray-300 px-2 py-1">
            <option value="all">All conditions</option>
            {conditions.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col">
          <span className="mb-1 text-gray-600">Wearable source</span>
          <select value={source} onChange={(e) => setSource(e.target.value)} className="rounded border border-gray-300 px-2 py-1">
            {(sources.length ? sources : ["csv"]).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col">
          <span className="mb-1 text-gray-600">Overlay metric</span>
          <select value={metric} onChange={(e) => setMetric(e.target.value as MetricKey)} className="rounded border border-gray-300 px-2 py-1">
            {(Object.keys(METRIC_LABELS) as MetricKey[]).map((m) => (
              <option key={m} value={m}>{METRIC_LABELS[m]}</option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-gray-500">Loading…</p>}

      {!loading && !hasData && (
        <p className="text-sm text-gray-500">
          No data in this range. Log some symptoms and import wearable CSV that overlaps these dates.
        </p>
      )}

      {mounted && hasData && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <ResponsiveContainer width="100%" height={340}>
            <ComposedChart data={data!.series} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={24} />
              <YAxis yAxisId="sev" domain={[0, 10]} tick={{ fontSize: 11 }} label={{ value: "Severity", angle: -90, position: "insideLeft", fontSize: 11 }} />
              <YAxis yAxisId="metric" orientation="right" tick={{ fontSize: 11 }} label={{ value: METRIC_LABELS[metric], angle: 90, position: "insideRight", fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line yAxisId="sev" type="monotone" dataKey="severity_avg" name="Severity (avg)" stroke="#2563eb" dot={false} connectNulls />
              <Line yAxisId="sev" type="monotone" dataKey="severity_max" name="Severity (max)" stroke="#dc2626" dot={false} connectNulls strokeDasharray="4 2" />
              <Line yAxisId="metric" type="monotone" dataKey={metric} name={METRIC_LABELS[metric]} stroke="#059669" dot={false} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {hasData && corr && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm">
          <h2 className="font-medium">{METRIC_LABELS[metric]} vs. symptom severity</h2>
          <p className="mt-1">
            <span className="font-medium">vs. worst (max):</span> {interpretR(corr.max.r, corr.max.n)}
          </p>
          <p className="mt-1">
            <span className="font-medium">vs. average:</span> {interpretR(corr.avg.r, corr.avg.n)}
          </p>
          <p className="mt-2 text-xs text-gray-500">
            Correlation describes how two measures move together over the same day. It is not proof of cause,
            and small samples are unreliable.
          </p>
        </div>
      )}
    </div>
  );
}
