/**
 * Today's date as an ISO calendar day (YYYY-MM-DD) in the server's local time.
 * Single-user / self-hosted, so local time is the right notion of "today".
 */
export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Add `n` days to an ISO calendar day (YYYY-MM-DD) and return YYYY-MM-DD.
 * Uses UTC math so it's stable regardless of the server's timezone / DST.
 */
export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}
