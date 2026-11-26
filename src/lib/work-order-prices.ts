import { timeRoundingOf } from "@/lib/billing-time";
import { type HomeOffices, type TravelContext, type TravelRule, travelRuleFor } from "@/lib/travel-charge";
import { type UrgentRule, urgentRuleFor } from "@/lib/urgent-surcharge";

// The prices a work order is charged at, besides each time entry's own rate (stamped when logged): the billing period
// that time is rounded to, the urgent surcharge, the trip charges and the preparation rate. An open job follows the
// company's (and its contract's) current settings; when it is completed they are saved on it (WorkOrder.prices), so
// later changes to those settings don't change jobs completed before them. Reopening the job drops them.

export type WorkOrderPrices = { block: number; urgent: UrgentRule; travel: TravelRule; prepRate: number };

type OrgPrices = Parameters<typeof urgentRuleFor>[0] & Parameters<typeof travelRuleFor>[0] & { timeRounding: unknown; roleRates: unknown };
type ContractPrices = NonNullable<Parameters<typeof urgentRuleFor>[1]> & NonNullable<Parameters<typeof travelRuleFor>[1]>;

/** Contract fields the prices depend on (select them with the work order's contract). */
export const CONTRACT_PRICE_FIELDS = { urgentFee: true, urgentPercent: true, travelIncluded: true, travelFee: true, travelKmRate: true } as const;

/**
 * The prices that apply now: the company's settings, with the contract's own where it sets them; `prepRate` is the
 * job's preparation rate from its technicians (livePrepRates in lib/work-orders.ts).
 */
export function currentPrices(org: OrgPrices, contract: ContractPrices | null | undefined, prepRate: number): WorkOrderPrices {
  return { block: timeRoundingOf(org.timeRounding), urgent: urgentRuleFor(org, contract), travel: travelRuleFor(org, contract), prepRate };
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);

/** Prices saved on a work order, or null when there are none (or they aren't readable). */
export function parsePrices(raw: unknown): WorkOrderPrices | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const u = (r.urgent ?? {}) as Record<string, unknown>;
  const t = (r.travel ?? {}) as Record<string, unknown>;
  const values = [num(r.block), num(r.prepRate), num(u.fee), num(u.percent), num(t.fee), num(t.radiusKm), num(t.kmRate)];
  if (values.some((v) => v === null) || typeof t.perTechnician !== "boolean" || typeof t.included !== "boolean") return null;
  const [block, prepRate, fee, percent, travelFee, radiusKm, kmRate] = values as number[];
  return { block, prepRate, urgent: { fee, percent }, travel: { fee: travelFee, radiusKm, kmRate, perTechnician: t.perTechnician, included: t.included } };
}

/** The prices of a work order: those saved when it was completed, else the current ones (`prepRate`: see currentPrices). */
export function pricesOf(org: OrgPrices, wo: { status: string; prices?: unknown; contract?: ContractPrices | null }, prepRate = 0): WorkOrderPrices {
  return (wo.status === "DONE" && parsePrices(wo.prices)) || currentPrices(org, wo.contract, prepRate);
}

/** workOrderCosts' arguments after the work order: billing period, urgent rule, trips and preparation rate. */
export function costArgs(org: OrgPrices & { timezone: string }, wo: Parameters<typeof pricesOf>[1], homes: HomeOffices | undefined, prepRate: number) {
  const p = pricesOf(org, wo, prepRate);
  const travel: TravelContext = { rule: p.travel, timeZone: org.timezone, homes };
  return [p.block, p.urgent, travel, p.prepRate] as const;
}
