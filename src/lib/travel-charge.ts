// Trips for on-site work: each time entry says whether the technician was on site or worked remotely. On-site
// time on a given day (company time zone) is charged one trip for that work order: one per technician (two
// technicians on site the same day are two trips), or, when the company chooses, one per work order whatever
// the number of technicians. Remote time adds none. A trip costs the fixed fee when the villa is within the
// radius (Settings → Organization, default 25 km; a villa without a distance counts as within it), and beyond it
// the rate per km × the villa's whole one-way distance. A service contract can include trips (none charged) or
// set its own fee and rate per km (each left empty = the company's).

export const WORK_MODES = ["ONSITE", "REMOTE"] as const;
export type WorkModeValue = (typeof WORK_MODES)[number];

export type TravelRule = { fee: number; radiusKm: number; kmRate: number; perTechnician: boolean; included: boolean };
type OrgStored = { travelFee: unknown; travelRadiusKm: number | null; travelKmRate: unknown; travelPerTechnician: boolean };
type ContractStored = { travelIncluded: boolean; travelFee: unknown; travelKmRate: unknown };

export const NO_TRAVEL: TravelRule = { fee: 0, radiusKm: 0, kmRate: 0, perTechnician: true, included: false };

/** The company's rule, with the contract's own fee / rate where it sets them, and none when it includes trips. */
export function travelRuleFor(org: OrgStored, contract?: ContractStored | null): TravelRule {
  const included = !!contract?.travelIncluded;
  return {
    fee: included ? 0 : Number(contract?.travelFee ?? org.travelFee ?? 0),
    radiusKm: Number(org.travelRadiusKm ?? 0),
    kmRate: included ? 0 : Number(contract?.travelKmRate ?? org.travelKmRate ?? 0),
    perTechnician: org.travelPerTechnician,
    included,
  };
}

/** Whether trips are charged at all under this rule. */
export const chargesTravel = (rule: TravelRule) => rule.fee > 0 || rule.kmRate > 0;

/** Whether a villa this far away (one way) is beyond the radius, i.e. charged per km. */
export const isFar = (distanceKm: number | null | undefined, rule: TravelRule) => distanceKm != null && distanceKm > rule.radiusKm;

/** The cost of one trip to a villa this far away (one way): the fixed fee, or the rate × the whole distance. */
export function tripCost(distanceKm: number | null | undefined, rule: TravelRule) {
  return isFar(distanceKm, rule) ? Math.round(distanceKm! * rule.kmRate * 100) / 100 : rule.fee;
}

export type TripEntry = { userId?: string | null; minutes: number | null; startedAt?: Date | string; mode?: string | null };

/** The calendar day of a moment in a time zone, as YYYY-MM-DD. */
export const dayKey = (d: Date | string, timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(d));

/** Trips on one work order: one per day with finished on-site time, per technician or for the whole job. */
export function countTrips(entries: TripEntry[], timeZone: string, perTechnician = true) {
  const seen = new Set<string>();
  for (const e of entries) {
    if ((e.minutes ?? 0) <= 0 || !e.startedAt || (e.mode ?? "ONSITE") !== "ONSITE") continue;
    seen.add(`${perTechnician ? (e.userId ?? "-") : ""}|${dayKey(e.startedAt, timeZone)}`);
  }
  return seen.size;
}

export type TravelContext = { rule: TravelRule; timeZone: string };

/** The trip rule for a work order (company + its contract) and the company time zone, as `workOrderCosts` takes them. */
export const travelOf = (org: OrgStored & { timezone: string }, contract?: ContractStored | null): TravelContext => ({
  rule: travelRuleFor(org, contract),
  timeZone: org.timezone,
});

/** What a work order's trips cost: the number of trips × the cost of one trip to its villa (none when not charged). */
export function travelCharge(entries: TripEntry[], distanceKm: number | null | undefined, travel: TravelContext | null) {
  if (!travel || !chargesTravel(travel.rule)) return { trips: 0, perTrip: 0, amount: 0, far: false };
  const trips = countTrips(entries, travel.timeZone, travel.rule.perTechnician);
  const perTrip = tripCost(distanceKm, travel.rule);
  return { trips, perTrip, amount: Math.round(trips * perTrip * 100) / 100, far: isFar(distanceKm, travel.rule) };
}
