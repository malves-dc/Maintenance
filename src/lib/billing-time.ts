// Billed time on work orders: each technician's time on a work order, day by day, is rounded up to whole blocks of
// the company's billing period (Settings → Organization, default 30 minutes), so 34 minutes in a day bill as 1 hour
// and 15 minutes on each of two days bill as 30 minutes each.
// The minutes actually logged are kept as they are (utilisation, the work order's time list); only what is
// charged — labour cost, billed hours, the client's service report — uses the rounded time.

import { dayKey } from "@/lib/travel-charge";

export const TIME_ROUNDING_OPTIONS = [0, 15, 30, 60] as const;
export const DEFAULT_TIME_ROUNDING = 30;

/** A stored block size, or the default when it isn't one of the options. */
export const timeRoundingOf = (v: unknown) =>
  v !== null && v !== undefined && v !== "" && (TIME_ROUNDING_OPTIONS as readonly number[]).includes(Number(v)) ? Number(v) : DEFAULT_TIME_ROUNDING;

/** Minutes rounded up to whole blocks (block 0 = no rounding). */
export function roundUpMinutes(minutes: number, block: number) {
  if (!block || minutes <= 0) return minutes;
  return Math.ceil(minutes / block) * block;
}

export type TimeEntryLike = { userId?: string | null; minutes: number | null; hourlyRate: unknown; startedAt?: Date | string };
export type PersonTime = { userId: string; minutes: number; billed: number; labor: number };
export type DayTime = PersonTime & { day: string };

/**
 * Time on one work order, per technician and day (in the company's time zone): minutes logged, minutes billed
 * (rounded up per person per day) and labour; `people` adds up each person's days. Labour is each entry's own rate ×
 * its minutes, scaled to the billed time (a person whose rate changed between entries keeps the mix). Running timers
 * (no minutes yet) don't count.
 */
export function billedTime(entries: TimeEntryLike[], block: number, timeZone = "UTC") {
  const by = new Map<string, { userId: string; day: string; minutes: number; rated: number }>();
  for (const e of entries) {
    const m = e.minutes ?? 0;
    if (m <= 0) continue;
    const userId = e.userId ?? "-";
    const day = e.startedAt ? dayKey(e.startedAt, timeZone) : "";
    const key = `${userId}|${day}`;
    const acc = by.get(key) ?? { userId, day, minutes: 0, rated: 0 };
    acc.minutes += m;
    acc.rated += m * Number(e.hourlyRate ?? 0);
    by.set(key, acc);
  }
  const days: DayTime[] = [...by.values()].map(({ userId, day, minutes, rated }) => {
    const billed = roundUpMinutes(minutes, block);
    return { userId, day, minutes, billed, labor: (rated / 60) * (billed / minutes) };
  });
  const people = new Map<string, PersonTime>();
  for (const { userId, minutes, billed, labor } of days) {
    const p = people.get(userId) ?? { userId, minutes: 0, billed: 0, labor: 0 };
    people.set(userId, { userId, minutes: p.minutes + minutes, billed: p.billed + billed, labor: p.labor + labor });
  }
  return {
    days,
    people: [...people.values()],
    minutes: days.reduce((s, d) => s + d.minutes, 0),
    billed: days.reduce((s, d) => s + d.billed, 0),
    labor: days.reduce((s, d) => s + d.labor, 0),
  };
}
