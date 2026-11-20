/** Local "yyyy-mm-dd" of a moment, as the device sees it. */
export function localDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Local "HH:MM" of a moment, as the device sees it. */
export function localTime(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Minutes as "2h 05m" / "45m". */
export function formatDuration(totalMinutes: number) {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

export type ClockInterval = { startedAt: Date; endedAt: Date; minutes: number; overnight: boolean };
export type ClockError = "incomplete" | "same" | "future";

/**
 * The interval for time typed as a day plus the clock-in and clock-out times ("HH:MM", in the device's time
 * zone). A clock-out earlier than the clock-in ends the next day (a night call-out), so an entry is at most
 * 23 h 59 min. The server clamps times in the future to now, so an interval that ends after `now` is refused.
 */
export function clockInterval(day: string, from: string, to: string, now = new Date()): ClockInterval | { error: ClockError } {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  const f = /^(\d{2}):(\d{2})$/.exec(from);
  const e = /^(\d{2}):(\d{2})$/.exec(to);
  if (!d || !f || !e) return { error: "incomplete" };
  if (from === to) return { error: "same" };
  const startedAt = new Date(+d[1], +d[2] - 1, +d[3], +f[1], +f[2]);
  const overnight = to < from;
  const endedAt = new Date(+d[1], +d[2] - 1, +d[3] + (overnight ? 1 : 0), +e[1], +e[2]);
  if (endedAt.getTime() > now.getTime()) return { error: "future" };
  return { startedAt, endedAt, minutes: Math.round((endedAt.getTime() - startedAt.getTime()) / 60_000), overnight };
}
