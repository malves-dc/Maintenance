// Rules of the Hours section (/hours): pure, shared by the server actions, the pages and the tests.
// Days are "yyyy-mm-dd" in the company's time zone; times are "HH:MM".

export const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const DAY_MINUTES = 24 * 60;

export function isDay(s: unknown): s is string {
  if (typeof s !== "string" || !DAY_RE.test(s)) return false;
  const d = new Date(`${s}T12:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function addDays(day: string, n: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** The Monday of the week `day` falls in. */
export function weekStart(day: string) {
  const dow = (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  return addDays(day, -dow);
}

export const monthStart = (day: string) => `${day.slice(0, 8)}01`;

/** A @db.Date value (UTC midnight) for a day, and back. */
export const dayToDate = (day: string) => new Date(`${day}T00:00:00Z`);
export const dateToDay = (d: Date) => d.toISOString().slice(0, 10);

/** The day and the HH:MM of an instant in `timeZone`. */
export function localDay(at: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}
export function localTime(at: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(at);
}

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/** Whether someone may still add, change or remove their own hours on `day` (managers always may). */
export function withinEditWindow(day: string, today: string, editDays: number, manager: boolean) {
  return manager || day >= addDays(today, -Math.max(0, editDays));
}

export type EntryInput = {
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  breakMinutes?: number | null;
  minutes?: number | null; // used when there are no start and end times
  description?: string | null;
};

export type EntryRules = {
  today: string;
  editDays: number;
  manager: boolean; // timesheets.manage: any day, future days, anyone's hours
  otherMinutes: number; // the person's other time that day (hours and work orders), without this entry
};

export type CleanEntry = { date: string; startTime: string | null; endTime: string | null; minutes: number; description: string };

/** Checks an entry; returns it tidied, or the message key (under "hours.errors") of the first problem. */
export function checkEntry(input: EntryInput, rules: EntryRules): { entry: CleanEntry } | { error: string } {
  const { date } = input;
  if (!isDay(date)) return { error: "date" };
  if (!rules.manager) {
    if (date > rules.today) return { error: "future" };
    if (!withinEditWindow(date, rules.today, rules.editDays, false)) return { error: "locked" };
  }
  const startTime = input.startTime || null;
  const endTime = input.endTime || null;
  if (startTime && !TIME_RE.test(startTime)) return { error: "start" };
  if (endTime && !TIME_RE.test(endTime)) return { error: "end" };
  if (endTime && !startTime) return { error: "start" };
  let minutes: number;
  if (startTime && endTime) {
    const span = toMin(endTime) - toMin(startTime);
    if (span <= 0) return { error: "endBeforeStart" };
    const pause = Math.max(0, Math.round(input.breakMinutes ?? 0));
    minutes = span - pause;
    if (minutes <= 0) return { error: "breakTooLong" };
  } else {
    minutes = Math.round(Number(input.minutes));
    if (!Number.isFinite(minutes) || minutes <= 0) return { error: "minutes" };
  }
  if (minutes > DAY_MINUTES) return { error: "minutesMax" };
  if (rules.otherMinutes + minutes > DAY_MINUTES) return { error: "dayOver24" };
  const description = (input.description ?? "").trim().slice(0, 4000);
  if (!description) return { error: "description" };
  return { entry: { date, startTime, endTime, minutes, description } };
}

/**
 * The entry a stopped timer leaves: the day and time it started (company time zone), the time it ended when that is
 * the same day, and the whole minutes (capped at a day). Null under a minute.
 */
export function timerEntry(startedAt: Date, endedAt: Date, timeZone: string) {
  const minutes = Math.min(DAY_MINUTES, Math.round((endedAt.getTime() - startedAt.getTime()) / 60_000));
  if (minutes < 1) return null;
  const date = localDay(startedAt, timeZone);
  const sameDay = localDay(endedAt, timeZone) === date;
  return { date, startTime: localTime(startedAt, timeZone), endTime: sameDay ? localTime(endedAt, timeZone) : null, minutes };
}

/** A typed duration in hours — "7:30", "7h30", "7,5", "7.5", "8" — as minutes; null when unreadable. */
export function parseDuration(text: string | null | undefined): number | null {
  const s = (text ?? "").trim().toLowerCase().replace(/\s+/g, "");
  if (!s) return null;
  const hm = s.match(/^(\d{1,2})(?::|h)(\d{1,2})?(?:m|min)?$/);
  if (hm) {
    const m = Number(hm[2] ?? 0);
    return m < 60 ? Number(hm[1]) * 60 + m : null;
  }
  const min = s.match(/^(\d{1,4})(?:m|min)$/);
  if (min) return Number(min[1]);
  const dec = s.match(/^\d{1,2}(?:[.,]\d{1,2})?$/);
  return dec ? Math.round(Number(s.replace(",", ".")) * 60) : null;
}

/** Minutes as "7:30" for a duration field. */
export const durationText = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;

/** Minutes as "7h 30" / "45 min". */
export function formatMinutes(min: number) {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${String(r).padStart(2, "0")}` : `${h}h`;
}

/** Minutes as decimal hours for spreadsheets (2 decimals). */
export const hoursDecimal = (min: number) => Math.round((min / 60) * 100) / 100;
