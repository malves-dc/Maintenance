import { parseRoleRates } from "@/lib/roles";

// Office time on a work order ("Preparação / Planeamento"): preparing and planning the job. Each work order starts
// with PREP_DEFAULT_MINUTES (WorkOrder.prepMinutes) and is charged at the company's Technician rate (Settings →
// Roles), as labour: it adds to the work order's labour and total. Not rounded to the billing period, not part of the
// urgent surcharge, and not in the client's service report (which lists the technicians' time on site).

export const PREP_DEFAULT_MINUTES = 15;
export const PREP_MAX_MINUTES = 24 * 60;

/** Cost per hour of preparation time: the company's Technician rate (0 when none is set). */
export const prepRateOf = (org: { roleRates: unknown }) => parseRoleRates(org.roleRates).TECHNICIAN ?? 0;

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
