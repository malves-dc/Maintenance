import "server-only";
import type { AppContext } from "@/lib/context";
import { dayStart } from "@/lib/audit-filter";
import { effectivePermissions } from "@/lib/rbac";
import { docRef } from "@/lib/series";
import { addDays, dateToDay, dayToDate, localDay, localTime } from "@/lib/timesheet-rules";

// The Hours section (/hours): hours typed at villas (TimesheetEntry) plus the time logged on work orders (TimeEntry),
// read together so a person's day, week and the reports add up both. Work-order time is only shown here: it is
// changed on its work order.

export type HoursCtx = Pick<AppContext, "db" | "organization" | "user" | "can">;

export function timesheetSettings(org: { timesheetEditDays: number; timesheetDailyHours: unknown; timezone: string }) {
  return { editDays: org.timesheetEditDays, dailyMinutes: Math.round(Number(org.timesheetDailyHours) * 60), timeZone: org.timezone };
}

/** Today in the company's time zone. */
export const todayOf = (ctx: Pick<HoursCtx, "organization">) => localDay(new Date(), ctx.organization.timezone);

export type HoursRow = {
  kind: "hours" | "wo";
  id: string;
  userId: string;
  userName: string;
  villaId: string | null;
  villaName: string | null;
  villaCode: string | null;
  date: string;
  startTime: string | null;
  endTime: string | null;
  minutes: number;
  description: string;
  workOrderId?: string;
  createdById?: string;
};

export type HoursFilter = { from: string; to: string; userIds?: string[]; villaIds?: string[] };

const VILLA = { select: { id: true, name: true, code: true } } as const;

/** Hours and finished work-order time between two days (inclusive), oldest first. */
export async function hoursRows(ctx: HoursCtx, f: HoursFilter): Promise<HoursRow[]> {
  const tz = ctx.organization.timezone;
  const users = f.userIds?.length ? { in: f.userIds } : undefined;
  const villas = f.villaIds?.length ? { in: f.villaIds } : undefined;
  const [entries, woTime] = await Promise.all([
    ctx.db.timesheetEntry.findMany({
      where: { date: { gte: dayToDate(f.from), lte: dayToDate(f.to) }, userId: users, villaId: villas },
      include: { user: { select: { name: true } }, villa: VILLA },
    }),
    // TimeEntry has no organizationId: scoped through its work order.
    ctx.db.timeEntry.findMany({
      where: {
        workOrder: { organizationId: ctx.organization.id, ...(villas ? { villaId: villas } : {}) },
        userId: users,
        endedAt: { not: null },
        minutes: { gt: 0 },
        startedAt: { gte: dayStart(f.from, tz)!, lt: dayStart(addDays(f.to, 1), tz)! },
      },
      include: { user: { select: { name: true } }, workOrder: { select: { id: true, year: true, number: true, title: true, villa: VILLA } } },
    }),
  ]);
  const rows: HoursRow[] = [
    ...entries.map((e) => ({
      kind: "hours" as const,
      id: e.id,
      userId: e.userId,
      userName: e.user.name,
      villaId: e.villaId,
      villaName: e.villa.name,
      villaCode: e.villa.code,
      date: dateToDay(e.date),
      startTime: e.startTime,
      endTime: e.endTime,
      minutes: e.minutes,
      description: e.description,
      createdById: e.createdById,
    })),
    ...woTime.map((t) => {
      const v = t.workOrder.villa;
      const sameDay = t.endedAt && localDay(t.endedAt, tz) === localDay(t.startedAt, tz);
      return {
        kind: "wo" as const,
        id: t.id,
        userId: t.userId,
        userName: t.user.name,
        villaId: v?.id ?? null,
        villaName: v?.name ?? null,
        villaCode: v?.code ?? null,
        date: localDay(t.startedAt, tz),
        startTime: localTime(t.startedAt, tz),
        endTime: sameDay ? localTime(t.endedAt!, tz) : null,
        minutes: t.minutes ?? 0,
        description: [docRef(t.workOrder), t.workOrder.title, t.note].filter(Boolean).join(" · "),
        workOrderId: t.workOrder.id,
      };
    }),
  ];
  return rows.sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? "99:99").localeCompare(b.startTime ?? "99:99"));
}

/** A person's minutes on a day (hours and work orders), leaving out one hours entry (the one being changed). */
export async function minutesOnDay(ctx: HoursCtx, userId: string, day: string, exceptEntryId?: string) {
  const rows = await hoursRows(ctx, { from: day, to: day, userIds: [userId] });
  return rows.filter((r) => !(r.kind === "hours" && r.id === exceptEntryId)).reduce((s, r) => s + r.minutes, 0);
}

/** Active staff who log hours in this company, by name. */
export async function hoursPeople(ctx: Pick<HoursCtx, "db">) {
  const rows = await ctx.db.membership.findMany({
    where: { active: true, role: { not: "REQUESTER" }, user: { erasedAt: null } },
    select: {
      userId: true,
      role: true,
      user: { select: { name: true } },
      jobRole: { select: { permissions: true } },
      organization: { select: { rolePermissions: true } },
    },
  });
  return rows
    .filter((r) => effectivePermissions(r.role, r.organization.rolePermissions, r.jobRole?.permissions).has("timesheets.log"))
    .map((r) => ({ id: r.userId, name: r.user.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Villas someone can log hours at: not archived, the ones they used lately first. */
export async function hoursVillas(ctx: Pick<HoursCtx, "db">, userId: string, keepId?: string | null) {
  const [villas, recent] = await Promise.all([
    ctx.db.villa.findMany({
      where: { OR: [{ archivedAt: null }, ...(keepId ? [{ id: keepId }] : [])] },
      select: { id: true, name: true, code: true, city: true },
      orderBy: [{ code: "asc" }, { name: "asc" }],
    }),
    ctx.db.timesheetEntry.findMany({ where: { userId }, select: { villaId: true }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  const order = [...new Set(recent.map((r) => r.villaId))].slice(0, 6);
  return {
    recent: order.map((id) => villas.find((v) => v.id === id)).filter((v): v is (typeof villas)[number] => !!v),
    all: villas,
  };
}

export const villaLabel = (v: { name: string | null; code: string | null }) => (v.code ? `${v.code} · ${v.name}` : (v.name ?? "—"));
