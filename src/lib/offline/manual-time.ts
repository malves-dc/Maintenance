/** Local "yyyy-mm-dd" of a moment, as the device sees it. */
export function localDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * The interval queued for minutes typed by hand in the field app. Today's time ends now (the usual case:
 * the work just done); an earlier day's starts at 09:00 that day. The server clamps times in the future to
 * now, so an interval must never end after `now`. Returns null for a future day or minutes outside 1–1440.
 */
export function manualInterval(day: string, minutes: number, now = new Date()): { startedAt: Date; endedAt: Date } | null {
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 24 * 60) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return null;
  const today = localDay(now);
  if (day > today) return null;
  if (day === today) return { startedAt: new Date(now.getTime() - minutes * 60_000), endedAt: now };
  const startedAt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 9, 0);
  const endedAt = new Date(Math.min(startedAt.getTime() + minutes * 60_000, now.getTime()));
  return { startedAt: new Date(endedAt.getTime() - minutes * 60_000), endedAt };
}
