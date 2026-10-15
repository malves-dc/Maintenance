import "server-only";
import type { AppContext } from "@/lib/context";
import type { ReportFilters } from "@/lib/report-filters";
import { compliance, SLA_STATUS_LOGS, slaCalendar, slaStates, type SlaState } from "@/lib/sla";
import { countByBucket, hoursBetween, mean, median, pmCompliance, sumBy, timeInStatus, workingDays } from "@/lib/report-math";
import { ACTIVE_STATUSES, workOrderCosts } from "@/lib/work-orders";
import { billedTime, timeRoundingOf } from "@/lib/billing-time";
import { urgentRuleFor } from "@/lib/urgent-surcharge";
import { villaAccess } from "@/lib/portal-scope";
import type { Prisma } from "@/generated/prisma/client";
import type { Priority, SystemType, WorkOrderType } from "@/generated/prisma/enums";
import { villaClient } from "@/lib/villa-client";

// Report data. Conventions (shown on the pages):
//  - counts, costs and SLA use work orders *opened* in the period;
//  - repair time uses work orders *completed* in the period;
//  - PM compliance uses preventive work *due* in the period (up to today).

type Ctx = Pick<AppContext, "db" | "organization">;

/** Repair work (MTTR and response time exclude planned work). */
export const REACTIVE_TYPES: WorkOrderType[] = ["REACTIVE", "CORRECTIVE", "EMERGENCY"];
export const STANDARD_HOURS_PER_DAY = 8;

export function woScope(f: ReportFilters): Prisma.WorkOrderWhereInput {
  return {
    ...(f.villaId ? { villaId: f.villaId } : f.clientId ? { villa: villaAccess(f.clientId) } : {}),
    ...(f.system ? { system: f.system } : {}),
  };
}

const inRange = (f: ReportFilters) => ({ gte: f.from, lte: f.to });

const URGENT_FIELDS = { urgentFee: true, urgentPercent: true } as const;
const costSelect = {
  priority: true,
  contract: { select: URGENT_FIELDS },
  timeEntries: { select: { userId: true, minutes: true, hourlyRate: true } },
  parts: { select: { quantity: true, unitCost: true } },
  otherCosts: { select: { amount: true } },
} as const;

// ── Overview

export async function overview(ctx: Ctx, f: ReportFilters, now = new Date()) {
  const scope = woScope(f);
  const [opened, completed, pmDue, openNow] = await Promise.all([
    ctx.db.workOrder.findMany({
      where: { ...scope, createdAt: inRange(f) },
      select: {
        type: true,
        status: true,
        createdAt: true,
        firstResponseAt: true,
        completedAt: true,
        statusLogs: SLA_STATUS_LOGS,
        ...costSelect,
        contract: { select: { responseTimeHours: true, resolutionTimeHours: true, businessHoursOnly: true, pauseOnHold: true, ...URGENT_FIELDS } },
      },
    }),
    ctx.db.workOrder.findMany({ where: { ...scope, status: "DONE", completedAt: inRange(f) }, select: { type: true, createdAt: true, completedAt: true } }),
    ctx.db.workOrder.findMany({
      where: { ...scope, type: "PREVENTIVE", dueDate: { gte: f.from, lte: f.to < now ? f.to : now } },
      select: { status: true, dueDate: true, completedAt: true },
    }),
    ctx.db.workOrder.count({ where: { ...scope, status: { in: ACTIVE_STATUSES } } }),
  ]);

  const repairs = completed.filter((w) => REACTIVE_TYPES.includes(w.type));
  const responses = opened.filter((w) => REACTIVE_TYPES.includes(w.type) && w.firstResponseAt).map((w) => hoursBetween(w.createdAt, w.firstResponseAt!));
  const calendar = slaCalendar(ctx.organization);
  const sla = opened.filter((w) => w.contract).map((w) => slaStates(w, w.contract, now, calendar));
  const block = timeRoundingOf(ctx.organization.timeRounding);
  const cost = opened.reduce((s, w) => s + workOrderCosts(w, block, urgentRuleFor(ctx.organization, w.contract)).total, 0);
  const trend = countByBucket({ opened: opened.map((w) => w.createdAt), completed: completed.map((w) => w.completedAt) }, f.from, f.to);

  return {
    opened: opened.length,
    completed: completed.length,
    openNow,
    mttrHours: mean(repairs.map((w) => hoursBetween(w.createdAt, w.completedAt!))),
    medianResponseHours: median(responses),
    slaResponse: compliance(sla.map((s) => s.response)),
    slaResolution: compliance(sla.map((s) => s.resolution)),
    pm: pmCompliance(pmDue),
    cost,
    trend,
  };
}

// ── Work orders

export async function workOrderBreakdown(ctx: Ctx, f: ReportFilters, now = new Date()) {
  const scope = woScope(f);
  const [opened, completed, pmDue] = await Promise.all([
    ctx.db.workOrder.findMany({
      where: { ...scope, createdAt: inRange(f) },
      select: { type: true, system: true, priority: true, villa: { select: { id: true, name: true } } },
    }),
    ctx.db.workOrder.findMany({
      where: { ...scope, status: "DONE", completedAt: inRange(f), type: { in: REACTIVE_TYPES } },
      select: { system: true, priority: true, createdAt: true, completedAt: true },
    }),
    ctx.db.workOrder.findMany({
      where: { ...scope, type: "PREVENTIVE", dueDate: { gte: f.from, lte: f.to < now ? f.to : now } },
      select: { status: true, dueDate: true, completedAt: true, villa: { select: { id: true, name: true } } },
    }),
  ]);

  const count = <K extends string>(key: (w: (typeof opened)[number]) => K) => sumBy(opened, key, () => 1) as [K, number][];
  const repairStats = <K extends string>(key: (w: (typeof completed)[number]) => K) => {
    const groups = new Map<K, number[]>();
    for (const w of completed) groups.set(key(w), [...(groups.get(key(w)) ?? []), hoursBetween(w.createdAt, w.completedAt!)]);
    return [...groups.entries()].map(([k, hrs]) => ({ key: k, count: hrs.length, mean: mean(hrs)!, median: median(hrs)! })).sort((a, b) => b.count - a.count);
  };
  const pmVillas = new Map<string, { name: string; rows: typeof pmDue }>();
  for (const w of pmDue) {
    const k = w.villa?.id ?? "-";
    pmVillas.set(k, { name: w.villa?.name ?? "—", rows: [...(pmVillas.get(k)?.rows ?? []), w] });
  }

  return {
    total: opened.length,
    byType: count((w) => w.type as WorkOrderType),
    bySystem: count((w) => (w.system ?? "NONE") as SystemType | "NONE"),
    byPriority: count((w) => w.priority as Priority),
    byVilla: sumBy(opened, (w) => w.villa?.name ?? null, () => 1).slice(0, 10),
    repairBySystem: repairStats((w) => (w.system ?? "NONE") as SystemType | "NONE"),
    repairByPriority: repairStats((w) => w.priority as Priority),
    pm: pmCompliance(pmDue),
    pmByVilla: [...pmVillas.entries()].map(([id, v]) => ({ id, name: v.name, ...pmCompliance(v.rows) })).sort((a, b) => (a.pct ?? 1) - (b.pct ?? 1)),
  };
}

// ── SLA

export async function slaReport(ctx: Ctx, f: ReportFilters, now = new Date()) {
  const wos = await ctx.db.workOrder.findMany({
    where: { ...woScope(f), createdAt: inRange(f), contractId: { not: null } },
    select: {
      id: true,
      number: true,
      title: true,
      status: true,
      createdAt: true,
      firstResponseAt: true,
      completedAt: true,
      villa: { select: { name: true } },
      contract: { select: { id: true, name: true, responseTimeHours: true, resolutionTimeHours: true, businessHoursOnly: true, pauseOnHold: true, client: { select: { name: true } } } },
      statusLogs: SLA_STATUS_LOGS,
    },
    orderBy: { createdAt: "desc" },
  });
  const calendar = slaCalendar(ctx.organization);
  const judged = wos.map((w) => ({ ...w, sla: slaStates(w, w.contract, now, calendar) }));
  const byContract = new Map<string, { name: string; client: string; response: SlaState[]; resolution: SlaState[] }>();
  for (const w of judged) {
    const c = w.contract!;
    const row = byContract.get(c.id) ?? { name: c.name, client: c.client.name, response: [], resolution: [] };
    row.response.push(w.sla.response);
    row.resolution.push(w.sla.resolution);
    byContract.set(c.id, row);
  }
  return {
    total: judged.length,
    response: compliance(judged.map((w) => w.sla.response)),
    resolution: compliance(judged.map((w) => w.sla.resolution)),
    contracts: [...byContract.entries()]
      .map(([id, r]) => ({ id, name: r.name, client: r.client, count: r.response.length, response: compliance(r.response), resolution: compliance(r.resolution) }))
      .sort((a, b) => b.count - a.count),
    breaches: judged.filter((w) => w.sla.response === "breached" || w.sla.resolution === "breached").slice(0, 50),
    judged,
  };
}

// ── Costs

export async function costReport(ctx: Ctx, f: ReportFilters) {
  const [wos, contracts] = await Promise.all([
    ctx.db.workOrder.findMany({
      where: { ...woScope(f), createdAt: inRange(f) },
      select: {
        id: true,
        number: true,
        title: true,
        system: true,
        villa: { select: { id: true, name: true, client: { select: { id: true, name: true } }, manager: { select: { id: true, name: true } }, billTo: true } },
        ...costSelect,
      },
    }),
    ctx.db.serviceContract.findMany({
      where: {
        monthlyFee: { not: null },
        status: { in: ["ACTIVE", "EXPIRED"] },
        startDate: { lte: f.to },
        ...(f.clientId ? { clientId: f.clientId } : {}),
        AND: [
          { OR: [{ endDate: null }, { endDate: { gte: f.from } }] },
          // For one villa only its own contracts count; a client-wide fee can't be split fairly.
          ...(f.villaId ? [{ villaId: f.villaId }] : []),
        ],
      },
      select: { clientId: true, monthlyFee: true, startDate: true, endDate: true },
    }),
  ]);
  const block = timeRoundingOf(ctx.organization.timeRounding);
  const rows = wos.map((w) => ({ ...w, cost: workOrderCosts(w, block, urgentRuleFor(ctx.organization, w.contract)) }));
  type Row = (typeof rows)[number];
  const group = (key: (r: Row) => { id: string; name: string } | null) => {
    const m = new Map<string, { id: string; name: string; labor: number; parts: number; other: number; urgent: number; total: number; count: number }>();
    for (const r of rows) {
      const k = key(r);
      if (!k) continue;
      const g = m.get(k.id) ?? { ...k, labor: 0, parts: 0, other: 0, urgent: 0, total: 0, count: 0 };
      g.labor += r.cost.labor;
      g.parts += r.cost.parts;
      g.other += r.cost.other;
      g.urgent += r.cost.urgent;
      g.total += r.cost.total;
      g.count += 1;
      m.set(k.id, g);
    }
    return [...m.values()].sort((a, b) => b.total - a.total);
  };

  // Contract fees earned in the period, pro rata by day (a month = 1/12 of a year).
  const fees = new Map<string, number>();
  const monthMs = (365.25 / 12) * 86_400_000;
  for (const c of contracts) {
    const start = c.startDate > f.from ? c.startDate : f.from;
    const end = c.endDate && c.endDate < f.to ? c.endDate : f.to;
    if (end > start) fees.set(c.clientId, (fees.get(c.clientId) ?? 0) + (Number(c.monthlyFee) * (end.getTime() - start.getTime())) / monthMs);
  }

  const totals = rows.reduce(
    (s, r) => ({ labor: s.labor + r.cost.labor, parts: s.parts + r.cost.parts, other: s.other + r.cost.other, urgent: s.urgent + r.cost.urgent, total: s.total + r.cost.total }),
    { labor: 0, parts: 0, other: 0, urgent: 0, total: 0 },
  );
  return {
    totals,
    rows,
    byVilla: group((r) => r.villa && { id: r.villa.id, name: r.villa.name }),
    byClient: group((r) => (r.villa && villaClient(r.villa)) || null).map((g) => ({ ...g, fees: fees.get(g.id) ?? 0 })),
    bySystem: group((r) => ({ id: r.system ?? "NONE", name: r.system ?? "NONE" })),
  };
}

// ── Technicians

export async function technicianReport(ctx: Ctx, f: ReportFilters) {
  const scope = woScope(f);
  const [withTime, completed] = await Promise.all([
    ctx.db.workOrder.findMany({
      where: { ...scope, timeEntries: { some: { startedAt: inRange(f) } } },
      select: { timeEntries: { where: { startedAt: inRange(f), minutes: { not: null } }, select: { userId: true, minutes: true, hourlyRate: true, user: { select: { name: true } } } } },
    }),
    ctx.db.workOrder.findMany({ where: { ...scope, status: "DONE", completedAt: inRange(f), completedById: { not: null } }, select: { completedById: true } }),
  ]);
  const people = new Map<string, { id: string; name: string; minutes: number; billed: number; labor: number; jobs: Set<number>; completed: number }>();
  const block = timeRoundingOf(ctx.organization.timeRounding);
  // Hours worked are the minutes logged (utilisation); labour and billed hours use each technician's time per
  // work order rounded up to the billing period.
  withTime.forEach((w, i) => {
    const names = new Map(w.timeEntries.map((e) => [e.userId, e.user.name]));
    for (const t of billedTime(w.timeEntries, block).people) {
      const p = people.get(t.userId) ?? { id: t.userId, name: names.get(t.userId) ?? "", minutes: 0, billed: 0, labor: 0, jobs: new Set<number>(), completed: 0 };
      p.minutes += t.minutes;
      p.billed += t.billed;
      p.labor += t.labor;
      p.jobs.add(i);
      people.set(t.userId, p);
    }
  });
  const doneBy = sumBy(completed, (w) => w.completedById, () => 1);
  const missing = doneBy.filter(([id]) => !people.has(id)).map(([id]) => id);
  if (missing.length) {
    const users = await ctx.db.membership.findMany({ where: { userId: { in: missing } }, select: { user: { select: { id: true, name: true } } } });
    for (const u of users) people.set(u.user.id, { id: u.user.id, name: u.user.name, minutes: 0, billed: 0, labor: 0, jobs: new Set(), completed: 0 });
  }
  for (const [id, n] of doneBy) {
    const p = people.get(id);
    if (p) p.completed = n;
  }
  const available = workingDays(f.from, f.to) * STANDARD_HOURS_PER_DAY;
  return {
    availableHours: available,
    people: [...people.values()]
      .map((p) => ({ id: p.id, name: p.name, hours: p.minutes / 60, billedHours: p.billed / 60, labor: p.labor, jobs: p.jobs.size, completed: p.completed, utilisation: available ? p.minutes / 60 / available : null }))
      .sort((a, b) => b.hours - a.hours),
  };
}

// ── Assets

export async function assetReport(ctx: Ctx, f: ReportFilters) {
  const assets = await ctx.db.asset.findMany({
    where: {
      archivedAt: null,
      ...(f.villaId ? { villaId: f.villaId } : f.clientId ? { villa: villaAccess(f.clientId) } : {}),
      ...(f.system ? { system: f.system } : {}),
    },
    select: {
      id: true,
      name: true,
      system: true,
      status: true,
      createdAt: true,
      villa: { select: { name: true } },
      statusLogs: { where: { createdAt: { lte: f.to } }, select: { status: true, createdAt: true }, orderBy: { createdAt: "asc" } },
      workOrders: { where: { createdAt: inRange(f), type: { in: REACTIVE_TYPES } }, select: { id: true } },
    },
  });
  const span = f.to.getTime() - f.from.getTime();
  const rows = assets.map((a) => {
    // Time before the asset existed doesn't count against it.
    const from = a.createdAt > f.from ? a.createdAt : f.from;
    const window = Math.max(0, f.to.getTime() - from.getTime());
    const down = timeInStatus(a.statusLogs, "OPERATIONAL", from, f.to, ["DOWN"]);
    const degraded = timeInStatus(a.statusLogs, "OPERATIONAL", from, f.to, ["DEGRADED"]);
    return {
      id: a.id,
      name: a.name,
      villa: a.villa.name,
      system: a.system,
      status: a.status,
      downHours: down / 3_600_000,
      degradedHours: degraded / 3_600_000,
      availability: window ? 1 - down / window : null,
      failures: a.workOrders.length,
    };
  });
  rows.sort((a, b) => b.downHours - a.downHours || b.failures - a.failures || a.name.localeCompare(b.name));
  return {
    rows,
    spanHours: span / 3_600_000,
    fleetAvailability: rows.length ? mean(rows.map((r) => r.availability ?? 1)) : null,
  };
}
