import type { Role } from "@/generated/prisma/enums";
import { parseRoleRates, workOrderRateFor, type RoleRates } from "@/lib/roles";

// Office time on a work order ("Preparação / Planeamento"): preparing and planning the job. Each work order starts
// with PREP_DEFAULT_MINUTES (WorkOrder.prepMinutes) and is charged at the cost per hour of the technician assigned to
// it (the role they take on the job), the highest one when there are several, or the company's Technician rate when
// nobody is (Settings → Roles); as labour: it adds to the work order's labour and total. A completed job keeps the
// rate it was completed at (lib/work-order-prices.ts). Not rounded to the billing period, not part of the
// urgent surcharge, and not in the client's service report (which lists the technicians' time on site).

export const PREP_DEFAULT_MINUTES = 15;
export const PREP_MAX_MINUTES = 24 * 60;

/** The company's Technician rate (0 when none is set): preparation on a job nobody is assigned to. */
export const prepRateOf = (org: { roleRates: unknown }) => parseRoleRates(org.roleRates).TECHNICIAN ?? 0;

/** An assigned person: the role they take on the job, and their membership (null when no longer an active member). */
export type PrepAssignee = {
  role: Role | null;
  jobRole: { access: Role; hourlyRate: unknown } | null;
  member: { role: Role; hourlyRate?: unknown; jobRole?: { hourlyRate: unknown } | null } | null;
};

/**
 * Cost per hour of a job's preparation: the highest rate among its technicians (each at the role they take on it;
 * the Super Admin and former members don't count, as for time), else `fallback` (the Technician rate).
 */
export function prepRateFor(assignees: PrepAssignee[], rates: RoleRates, fallback: number) {
  const own = assignees
    .filter((a) => a.member && a.member.role !== "OWNER")
    .map((a) => workOrderRateFor(a.member!, a, rates))
    .filter((r): r is number => r !== null && Number.isFinite(r));
  return own.length ? Math.max(...own) : fallback;
}

/** Cost of `minutes` of preparation at `rate` per hour. */
export const prepCost = (minutes: number | null | undefined, rate: number) => ((minutes ?? 0) * rate) / 60;

/**
 * Who can change a work order's preparation time: the technicians assigned to it while it is open, and those with
 * workOrders.prepTime (Super Admin, administrators and accountants by default) until it is invoiced.
 */
export function canChangePrep(p: { hasPermission: boolean; canExecute: boolean; assigned: boolean; closed: boolean; invoiced: boolean }) {
  if (p.invoiced) return false;
  if (p.hasPermission) return true;
  return p.canExecute && p.assigned && !p.closed;
}
