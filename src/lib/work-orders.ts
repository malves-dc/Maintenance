import "server-only";
import type { AppContext } from "@/lib/context";

/** What work-order logic needs; the PM scheduler builds one without a signed-in request. */
export type WoCtx = Pick<AppContext, "db" | "organization" | "user">;
import { assertOwned, nextNumber } from "@/lib/db/tenant";
import { notify, notifyExternal } from "@/lib/notify";
import { contractFor } from "@/lib/contracts";
import { effectivePermissions } from "@/lib/rbac";
import { parseRoleRates, workOrderRateFor } from "@/lib/roles";
import { billedTime, type TimeEntryLike } from "@/lib/billing-time";
import { canLogTime, withoutTime } from "@/lib/wo-time";
import { syncReportRevision } from "@/lib/report-revision";
import { NO_SURCHARGE, urgentSurcharge, type UrgentRule } from "@/lib/urgent-surcharge";
import { travelCharge, type TravelContext, type TripEntry } from "@/lib/travel-charge";
import type { ChecklistItemType, Priority, SystemType, WorkOrderStatus, WorkOrderType } from "@/generated/prisma/enums";

export const ACTIVE_STATUSES: WorkOrderStatus[] = ["OPEN", "IN_PROGRESS", "ON_HOLD"];

export class WorkOrderError extends Error {
  constructor(public code: "requiredItems" | "invalidRef" | "invalidAssignee" | "locked" | "alreadySigned" | "signOffRequired" | "reportRequired" | "timeRequired" | "noTechnician" | "timeNotAssigned") {
    super(code);
  }
}

export type ChecklistItemInput = {
  type: ChecklistItemType;
  label: string;
  description?: string | null;
  required?: boolean;
  options?: string[];
  unit?: string | null;
  meterId?: string | null;
};

export type WorkOrderInput = {
  title: string;
  description?: string | null;
  priority?: Priority;
  type?: WorkOrderType;
  system?: SystemType | null;
  villaId?: string | null;
  areaId?: string | null;
  assetId?: string | null;
  teamId?: string | null;
  procedureId?: string | null;
  pmScheduleId?: string | null;
  contractId?: string | null;
  alertMeterId?: string | null;
  dueDate?: Date | null;
  startDate?: Date | null;
  estimatedMinutes?: number | null;
  assigneeIds?: string[];
  categoryIds?: string[];
  clientVisible?: boolean;
  items?: ChecklistItemInput[];
};

/** Validates villa/area/asset/team consistency and fills villa/area/system from the asset. */
export async function resolveRefs(ctx: WoCtx, input: WorkOrderInput) {
  await assertOwned(ctx.db, "team", [input.teamId]);
  await assertOwned(ctx.db, "procedure", [input.procedureId]);
  let { villaId = null, areaId = null, system = null } = input;
  if (input.assetId) {
    const asset = await ctx.db.asset.findUnique({ where: { id: input.assetId }, select: { villaId: true, areaId: true, system: true } });
    if (!asset || (villaId && asset.villaId !== villaId)) throw new WorkOrderError("invalidRef");
    villaId = asset.villaId;
    areaId = areaId ?? asset.areaId;
    system = system ?? asset.system;
  }
  if (villaId) await assertOwned(ctx.db, "villa", [villaId]);
  if (areaId) {
    const ok = await ctx.db.area.count({ where: { id: areaId, ...(villaId ? { villaId } : {}) } });
    if (!ok) throw new WorkOrderError("invalidRef");
  }
  return { villaId, areaId, system };
}

/** Assignees must be active, non-client members of the org. */
/** Active members who can carry out work orders (with the company's permission settings), by name: the assignee choices. */
export async function assignableUsers(db: WoCtx["db"]) {
  const rows = await db.membership.findMany({
    where: { active: true, role: { notIn: ["REQUESTER", "OWNER"] } }, // the owner doesn't do field work
    select: { role: true, jobRole: { select: { permissions: true } }, organization: { select: { rolePermissions: true } }, user: { select: { id: true, name: true } } },
  });
  return rows
    .filter((r) => effectivePermissions(r.role, r.organization.rolePermissions, r.jobRole?.permissions).has("workOrders.execute"))
    .map((r) => r.user)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function validateAssignees(ctx: WoCtx, ids: string[] = []) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return unique;
  const allowed = new Set((await assignableUsers(ctx.db)).map((u) => u.id));
  if (!unique.every((id) => allowed.has(id))) throw new WorkOrderError("invalidAssignee");
  return unique;
}

/** Drops ids that can no longer be assigned (left the company, or their role lost "carry out work orders"). */
export async function stillAssignable(ctx: WoCtx, ids: string[]) {
  if (ids.length === 0) return ids;
  const allowed = new Set((await assignableUsers(ctx.db)).map((u) => u.id));
  return ids.filter((id) => allowed.has(id));
}

/** Categories must be the org's own (they are connected, which the tenant guard doesn't check). */
export async function validateCategories(ctx: WoCtx, ids: string[] = []) {
  const unique = [...new Set(ids)];
  try {
    await assertOwned(ctx.db, "category", unique);
  } catch {
    throw new WorkOrderError("invalidRef");
  }
  return unique;
}

export async function createWorkOrder(ctx: WoCtx, input: WorkOrderInput) {
  const refs = await resolveRefs(ctx, input);
  const assigneeIds = await validateAssignees(ctx, input.assigneeIds);
  const categoryIds = await validateCategories(ctx, input.categoryIds);

  let items = input.items ?? [];
  if (input.procedureId && items.length === 0) {
    const proc = await ctx.db.procedure.findUnique({ where: { id: input.procedureId }, include: { items: { orderBy: { sortOrder: "asc" } } } });
    items = proc?.items ?? [];
  }
  items = await linkMeterItems(ctx, input.assetId ?? null, items);

  const number = await nextNumber(ctx.organization.id, "workOrder");
  const wo = await ctx.db.workOrder.create({
    data: {
      organizationId: ctx.organization.id,
      number,
      title: input.title,
      description: input.description ?? null,
      priority: input.priority ?? "NONE",
      type: input.type ?? "REACTIVE",
      ...refs,
      assetId: input.assetId ?? null,
      teamId: input.teamId ?? null,
      procedureId: input.procedureId ?? null,
      pmScheduleId: input.pmScheduleId ?? null,
      contractId: input.contractId ?? (await contractFor(ctx.db, refs.villaId, refs.system)),
      alertMeterId: input.alertMeterId ?? null,
      dueDate: input.dueDate ?? null,
      startDate: input.startDate ?? null,
      estimatedMinutes: input.estimatedMinutes ?? null,
      clientVisible: input.clientVisible ?? true,
      createdById: ctx.user.id,
      assignees: { create: assigneeIds.map((userId) => ({ userId })) },
      categories: { connect: categoryIds.map((id) => ({ id })) },
      items: {
        create: items.map((it, i) => ({
          sortOrder: i,
          type: it.type,
          label: it.label,
          description: it.description ?? null,
          required: it.required ?? false,
          options: it.options ?? [],
          unit: it.unit ?? null,
          meterId: it.meterId ?? null,
        })),
      },
      statusLogs: { create: { toStatus: "OPEN", userId: ctx.user.id } },
    },
  });
  await notifyAssigned(ctx, wo, assigneeIds);
  return wo;
}

/** WO_ASSIGNED to people newly put on a work order. */
export async function notifyAssigned(ctx: WoCtx, wo: { id: string; number: number; title: string }, userIds: string[]) {
  await notify(ctx, userIds, { type: "WO_ASSIGNED", data: { number: wo.number, title: wo.title, actor: ctx.user.name }, link: `/work-orders/${wo.id}` });
}

/**
 * Meter-reading steps without a meter get linked to the asset's meter when exactly one
 * meter on that asset has the same unit (e.g. a "%" step and the UPS "Battery" meter).
 */
async function linkMeterItems(ctx: WoCtx, assetId: string | null, items: ChecklistItemInput[]) {
  if (!assetId || !items.some((i) => i.type === "METER_READING" && !i.meterId)) return items;
  const meters = await ctx.db.meter.findMany({ where: { assetId }, select: { id: true, unit: true } });
  return items.map((i) => {
    if (i.type !== "METER_READING" || i.meterId) return i;
    const matches = meters.filter((m) => !i.unit || m.unit.toLowerCase() === i.unit.toLowerCase());
    return matches.length === 1 ? { ...i, meterId: matches[0].id, unit: i.unit ?? matches[0].unit } : i;
  });
}

/** A job can only be completed once the client has signed, or it is marked "client absent". */
export function isSignedOff(wo: { signatureUrl: string | null; clientAbsent: boolean }) {
  return !!wo.signatureUrl || wo.clientAbsent;
}

/** The technician's report (what was done) is filled in: required to complete a job. */
export function hasWorkReport(wo: { workReport: string | null }) {
  return !!wo.workReport?.trim();
}

export function isItemComplete(item: { type: ChecklistItemType; value: string | null }) {
  if (item.type === "HEADING") return true;
  if (item.type === "CHECKBOX") return item.value === "true";
  return !!item.value && item.value.trim() !== "";
}

/** Applies a status transition with its side effects (completion stamps, timers, SLA response). */
export async function changeStatus(ctx: WoCtx, workOrderId: string, to: WorkOrderStatus, note?: string | null) {
  const wo = await ctx.db.workOrder.findUnique({
    where: { id: workOrderId },
    include: {
      items: { select: { type: true, value: true, required: true } },
      assignees: { select: { userId: true } },
      timeEntries: { select: { userId: true, minutes: true, endedAt: true } },
    },
  });
  if (!wo) throw new WorkOrderError("invalidRef");
  if (wo.status === to) return wo;

  if (to === "DONE" && wo.items.some((i) => i.required && !isItemComplete(i))) {
    throw new WorkOrderError("requiredItems");
  }
  if (to === "DONE") {
    const technicians = await jobTechnicians(ctx, wo.assignees.map((a) => a.userId));
    if (technicians.length === 0) throw new WorkOrderError("noTechnician");
    if (withoutTime(technicians, wo.timeEntries).length > 0) throw new WorkOrderError("timeRequired");
  }
  if (to === "DONE" && !hasWorkReport(wo)) throw new WorkOrderError("reportRequired");
  if (to === "DONE" && !isSignedOff(wo)) throw new WorkOrderError("signOffRequired");

  const now = new Date();
  if (to === "DONE" || to === "CANCELLED") await stopRunningTimers(ctx, workOrderId, now);

  const updated = await ctx.db.workOrder.update({
    where: { id: workOrderId },
    data: {
      status: to,
      completedAt: to === "DONE" ? now : null,
      completedById: to === "DONE" ? ctx.user.id : null,
      firstResponseAt: wo.firstResponseAt ?? (to === "IN_PROGRESS" || to === "DONE" ? now : null),
      statusLogs: { create: { fromStatus: wo.status, toStatus: to, userId: ctx.user.id, note: note || null } },
    },
  });
  if (to === "DONE") await syncReportRevision(ctx.db, workOrderId);
  await notifyStatus(ctx, updated, note);
  return updated;
}

/** The people who have to log time on a job, out of those assigned: active members, never the owner. */
export async function jobTechnicians(ctx: Pick<WoCtx, "db">, userIds: string[]) {
  if (userIds.length === 0) return [];
  const rows = await ctx.db.membership.findMany({
    where: { userId: { in: userIds }, active: true, role: { not: "OWNER" } },
    select: { user: { select: { id: true, name: true } } },
  });
  return rows.map((r) => ({ userId: r.user.id, name: r.user.name }));
}

/** Time is logged by the technicians assigned to the job, each their own (lib/wo-time.ts). */
export async function assertCanLogTime(ctx: AppContext, woId: string) {
  const wo = await ctx.db.workOrder.findUnique({ where: { id: woId }, select: { assignees: { where: { userId: ctx.user.id }, select: { userId: true } } } });
  if (!wo) throw new WorkOrderError("invalidRef");
  if (!canLogTime(ctx.role, wo.assignees.length > 0)) throw new WorkOrderError("timeNotAssigned");
}

/** WO_STATUS to the creator and assignees; when a client-visible job from a request is done, the requester too. */
async function notifyStatus(ctx: WoCtx, wo: { id: string; number: number; title: string; status: WorkOrderStatus; createdById: string; clientVisible: boolean }, note?: string | null) {
  const assignees = await ctx.db.workOrderAssignee.findMany({ where: { workOrderId: wo.id }, select: { userId: true } });
  const data = { number: wo.number, title: wo.title, status: wo.status, actor: ctx.user.name, note: note ?? "" };
  await notify(ctx, [wo.createdById, ...assignees.map((a) => a.userId)], { type: "WO_STATUS", data, link: `/work-orders/${wo.id}` });

  if (wo.status !== "DONE" || !wo.clientVisible) return;
  const req = await ctx.db.request.findFirst({ where: { workOrderId: wo.id }, select: { id: true, number: true, requesterId: true, requesterEmail: true } });
  if (!req) return;
  const clientData = { ...data, note: "", request: req.number };
  if (req.requesterId) await notify(ctx, [req.requesterId], { type: "WO_STATUS", data: clientData, link: `/portal/requests/${req.id}` });
  else await notifyExternal(ctx.organization, req.requesterEmail, ctx.organization.defaultLocale, "WO_STATUS", clientData);
}

export async function stopRunningTimers(ctx: WoCtx, workOrderId: string, at = new Date(), userId?: string) {
  const running = await ctx.db.timeEntry.findMany({ where: { workOrderId, endedAt: null, ...(userId ? { userId } : {}) } });
  for (const e of running) {
    await ctx.db.timeEntry.update({
      where: { id: e.id },
      data: { endedAt: at, minutes: Math.max(1, Math.round((at.getTime() - e.startedAt.getTime()) / 60_000)) },
    });
  }
}

/**
 * Labour + parts + other costs (+ urgent surcharge and trips) for a work order. Labour uses billed time: each technician's minutes rounded up
 * to `block` (the company's billing period, see lib/billing-time.ts); `minutes` is the time actually logged.
 */
export function workOrderCosts(
  wo: {
    priority?: string | null;
    timeEntries: (TimeEntryLike & Partial<TripEntry>)[];
    otherCosts: { amount: unknown }[];
    parts?: { quantity: unknown; unitCost: unknown }[];
    /** Select the villa's distanceKm and the entries' startedAt + mode whenever `travel` is passed. */
    villa?: { distanceKm: number | null } | null;
  },
  block: number,
  /** The urgent surcharge that applies to this work order (see lib/urgent-surcharge.ts); none when omitted. */
  urgentRule: UrgentRule = NO_SURCHARGE,
  /** The company's trip charges (see lib/travel-charge.ts); none when omitted. */
  travel: TravelContext | null = null,
) {
  const time = billedTime(wo.timeEntries, block);
  const other = wo.otherCosts.reduce((s, c) => s + Number(c.amount), 0);
  const parts = (wo.parts ?? []).reduce((s, p) => s + Number(p.quantity) * Number(p.unitCost), 0);
  const urgent = urgentSurcharge(wo.priority, time.labor, urgentRule);
  const trips = travel ? travelCharge(wo.timeEntries, wo.villa?.distanceKm, travel) : null;
  const travelCost = trips?.amount ?? 0;
  return {
    minutes: time.minutes,
    billedMinutes: time.billed,
    labor: time.labor,
    parts,
    other,
    urgent,
    travel: travelCost,
    trips: trips?.trips ?? 0,
    perTrip: trips?.perTrip ?? 0,
    total: time.labor + parts + other + urgent + travelCost,
  };
}

const ASSIGNEE_ROLE = { role: true, jobRole: { select: { access: true, hourlyRate: true } } } as const;

/** My cost per hour on this job (the role I took on it, else my own): stamped on the time I log on it. */
export async function myRateOn(ctx: AppContext, woId: string) {
  const wo = await ctx.db.workOrder.findUnique({ where: { id: woId }, select: { assignees: { where: { userId: ctx.user.id }, select: ASSIGNEE_ROLE } } });
  const a = wo?.assignees[0];
  return a?.role || a?.jobRole ? workOrderRateFor(ctx.membership, a, parseRoleRates(ctx.organization.roleRates)) : ctx.hourlyRate;
}

/** After someone's role on a job changes, their time on it is charged at the new role's rate. */
export async function restampRate(ctx: AppContext, woId: string, userId: string) {
  const [wo, member] = await Promise.all([
    ctx.db.workOrder.findUnique({ where: { id: woId }, select: { assignees: { where: { userId }, select: ASSIGNEE_ROLE } } }),
    ctx.db.membership.findFirst({ where: { userId }, select: { role: true, hourlyRate: true, jobRole: { select: { hourlyRate: true } } } }),
  ]);
  if (!wo || !member) return;
  const rate = workOrderRateFor(member, wo.assignees[0], parseRoleRates(ctx.organization.roleRates));
  await ctx.db.timeEntry.updateMany({ where: { workOrderId: woId, userId }, data: { hourlyRate: rate } });
}
