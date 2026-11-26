import "server-only";
import { prisma } from "@/lib/db/client";
import { tenantDb } from "@/lib/db/tenant";
import { nextOccurrence, type Recurrence } from "@/lib/pm-schedule";
import { createWorkOrder, stillAssignable, WorkOrderError, type WoCtx } from "@/lib/work-orders";
import { notifyPreventiveBlocked } from "@/lib/villa-block";
import type { PMSchedule } from "@/generated/prisma/client";

const DAY = 86_400_000;
export const MAX_LEAD_DAYS = 60;

type ScheduleWithAssignees = PMSchedule & { assignees: { userId: string }[] };

export function recurrenceOf(
  s: Pick<PMSchedule, "frequency" | "interval" | "daysOfWeek" | "startDate" | "endDate">,
  timeZone: string,
): Recurrence | null {
  if (!s.frequency || !s.startDate) return null;
  return { frequency: s.frequency, interval: s.interval, daysOfWeek: s.daysOfWeek, startDate: s.startDate, endDate: s.endDate, timeZone };
}

/** First due date for a (new or edited) time-based schedule: the next occurrence from now on. */
export function initialNextDue(s: Parameters<typeof recurrenceOf>[0], timeZone: string, now = new Date()): Date | null {
  const r = recurrenceOf(s, timeZone);
  if (!r) return null;
  const from = r.startDate > now ? r.startDate : now;
  return nextOccurrence(r, new Date(from.getTime() - 1));
}

const villaBlocked = (e: unknown) => e instanceof WorkOrderError && e.code === "villaBlocked";

/** Creates the preventive work order for one occurrence of a schedule. */
export async function generateWorkOrder(ctx: WoCtx, s: ScheduleWithAssignees, dueDate: Date) {
  return createWorkOrder(ctx, {
    title: s.title,
    description: s.description,
    type: "PREVENTIVE",
    priority: s.priority,
    system: s.system,
    villaId: s.villaId,
    assetId: s.assetId,
    teamId: s.teamId,
    procedureId: s.procedureId,
    pmScheduleId: s.id,
    estimatedMinutes: s.estimatedMinutes,
    // A schedule outlives its people: skip anyone who can no longer be assigned instead of failing.
    assigneeIds: await stillAssignable(ctx, s.assignees.map((a) => a.userId)),
    startDate: s.leadDays > 0 ? new Date(dueDate.getTime() - s.leadDays * DAY) : null,
    dueDate,
  });
}

/** Scheduler context for an org, acting as the schedule's creator (or the org owner). */
async function schedulerCtx(organizationId: string, createdById: string | null): Promise<WoCtx | null> {
  const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!organization) return null;
  const creator = createdById ? await prisma.membership.findFirst({ where: { organizationId, userId: createdById, active: true }, include: { user: true } }) : null;
  const author =
    creator ??
    (await prisma.membership.findFirst({
      where: { organizationId, active: true, role: { in: ["OWNER", "ADMIN"] } },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    }));
  if (!author) return null;
  // Audited as the system (no user): the scheduler, not a person, creates these work orders.
  return { organization, user: author.user, db: tenantDb(organizationId, { userId: null, ip: null }) };
}

/**
 * Generates work orders for time-based schedules whose next due date (minus lead time) has
 * arrived. Each occurrence is claimed by atomically advancing `nextDueAt`, so concurrent
 * runners can't double-create. Missed occurrences collapse into one overdue WO.
 */
export async function runDueSchedules(opts: { organizationId?: string; now?: Date } = {}) {
  const now = opts.now ?? new Date();
  const candidates = await prisma.pMSchedule.findMany({
    where: {
      active: true,
      trigger: "TIME",
      nextDueAt: { not: null, lte: new Date(now.getTime() + MAX_LEAD_DAYS * DAY) },
      ...(opts.organizationId ? { organizationId: opts.organizationId } : {}),
    },
    include: { assignees: { select: { userId: true } }, organization: { select: { timezone: true } } },
  });

  let created = 0;
  let blocked = 0;
  for (const s of candidates) {
    const due = s.nextDueAt!;
    if (due.getTime() - s.leadDays * DAY > now.getTime()) continue;
    const r = recurrenceOf(s, s.organization.timezone);
    // Advance past everything already due, so a long outage yields one WO, not a backlog.
    let next = r ? nextOccurrence(r, due) : null;
    while (next && r && next.getTime() - s.leadDays * DAY <= now.getTime()) next = nextOccurrence(r, next);

    const claimed = await prisma.pMSchedule.updateMany({
      where: { id: s.id, nextDueAt: due },
      data: { nextDueAt: next, lastGeneratedAt: now, ...(next ? {} : { active: false }) },
    });
    if (claimed.count !== 1) continue;

    const ctx = await schedulerCtx(s.organizationId, s.createdById);
    if (!ctx) continue;
    try {
      await generateWorkOrder(ctx, s, due);
      created++;
    } catch (e) {
      // Blocked villa: this occurrence is skipped for good (the schedule moves on) and the managers are told.
      if (villaBlocked(e)) {
        blocked++;
        await notifyPreventiveBlocked(ctx, s, due).catch((err) => console.error(`[pm] schedule ${s.id}: blocked-villa notice failed`, err));
        continue;
      }
      // Roll the claim back so the next run retries (e.g. a referenced asset was deleted mid-run).
      await prisma.pMSchedule.update({ where: { id: s.id }, data: { nextDueAt: due, active: true } });
      console.error(`[pm] schedule ${s.id} failed`, e);
    }
  }
  return { checked: candidates.length, created, blocked };
}

/** Meter-based schedules: create a WO every `meterInterval` units since the last one. */
export async function onMeterReading(ctx: WoCtx, meterId: string, value: number) {
  const schedules = await ctx.db.pMSchedule.findMany({
    where: { meterId, trigger: "METER", active: true },
    include: { assignees: { select: { userId: true } } },
  });
  let created = 0;
  for (const s of schedules) {
    const base = s.lastMeterValue;
    // First reading sets the baseline; a lower value means the meter was reset/replaced.
    if (base === null || value < base || !s.meterInterval) {
      await ctx.db.pMSchedule.update({ where: { id: s.id }, data: { lastMeterValue: value } });
      continue;
    }
    if (value - base < s.meterInterval) continue;
    const claimed = await ctx.db.pMSchedule.updateMany({
      where: { id: s.id, lastMeterValue: base },
      data: { lastMeterValue: value, lastGeneratedAt: new Date() },
    });
    if (claimed.count !== 1) continue;
    const due = new Date(Date.now() + Math.max(1, s.leadDays) * DAY);
    try {
      await generateWorkOrder(ctx, s, due);
      created++;
    } catch (e) {
      if (!villaBlocked(e)) throw e;
      await notifyPreventiveBlocked(ctx, s, due); // skipped: its villa is blocked
    }
  }
  return created;
}
