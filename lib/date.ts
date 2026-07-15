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
