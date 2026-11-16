// Trips for on-site work: each time entry says whether the technician was on site or worked remotely. On-site
// time on a given day (company time zone) is charged one trip for that work order: one per technician (two
// technicians on site the same day are two trips), or, when the company chooses, one per office per work order
// (technicians who came from the same office share it; from two offices, two trips). Remote time adds none.
// A trip costs the fixed fee when the villa is within the radius of where the trip left from (Settings →
// Organization, default 25 km; an unknown distance counts as within it), and beyond it the rate per km × the
// whole one-way distance. A service contract can include trips (none charged) or set its own fee and rate per km
// (each left empty = the company's).
//
// Offices (Settings → Offices): a trip leaves from the office the technician was given on that work order, else
// their primary office, else the villa's default office. Its distance is that office's distance to the villa
// (VillaOfficeDistance); without offices it is the villa's own distanceKm, as before.

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

/** Where a work order's villa is, as `TRAVEL_VILLA_SELECT` loads it. */
export type VillaPlaces = {
  distanceKm: number | null;
  defaultOfficeId?: string | null;
  officeDistances?: { officeId: string; distanceKm: number }[];
};
/** The office each person on the job leaves from for it (WorkOrderAssignee.officeId; null = their own). */
export type AssigneeOffice = { userId: string; officeId?: string | null };

/** The selects `workOrderCosts` needs for trips: the villa's distances and the assignees' offices on the job. */
export const TRAVEL_VILLA_SELECT = { distanceKm: true, defaultOfficeId: true, officeDistances: { select: { officeId: true, distanceKm: true } } } as const;
export const TRAVEL_ASSIGNEE_SELECT = { userId: true, officeId: true } as const;

/** Each person's primary office (lib/offices.ts `homeOffices`). */
export type HomeOffices = ReadonlyMap<string, string>;

/** The office a person's trip to this villa leaves from: the one set on the job, their primary office, the villa's. */
export function tripOffice(userId: string | null | undefined, villa: VillaPlaces | null | undefined, assignees: AssigneeOffice[] = [], homes?: HomeOffices) {
  const onJob = userId ? assignees.find((a) => a.userId === userId)?.officeId : null;
  return onJob ?? (userId ? homes?.get(userId) : null) ?? villa?.defaultOfficeId ?? null;
}

/**
 * One-way km from an office to the villa: the stored distance for that office (the villa's own distance when it is
 * its default office and none is stored), or the villa's own distance when no office applies. Null = unknown.
 */
export function officeDistance(villa: VillaPlaces | null | undefined, officeId: string | null) {
  if (!villa) return null;
  if (!officeId) return villa.distanceKm;
  const stored = villa.officeDistances?.find((d) => d.officeId === officeId);
  if (stored) return stored.distanceKm;
  return officeId === villa.defaultOfficeId ? villa.distanceKm : null;
}

/** Where a work order's trips leave from: its villa, the offices set on the job and each person's primary office. */
export type TripPlaces = { villa?: VillaPlaces | null; assignees?: AssigneeOffice[]; homes?: HomeOffices };

export type TripLine = { officeId: string | null; distanceKm: number | null; trips: number; perTrip: number; amount: number; far: boolean };

/**
 * The trips on one work order, one per day with finished on-site time: per technician, or per office the
 * technicians came from. Each comes with the office it left from.
 */
export function tripsOf(entries: TripEntry[], timeZone: string, perTechnician = true, places: TripPlaces = {}) {
  const trips = new Map<string, string | null>();
  for (const e of entries) {
    if ((e.minutes ?? 0) <= 0 || !e.startedAt || (e.mode ?? "ONSITE") !== "ONSITE") continue;
    const office = tripOffice(e.userId, places.villa, places.assignees, places.homes);
    trips.set(`${perTechnician ? (e.userId ?? "-") : (office ?? "-")}|${dayKey(e.startedAt, timeZone)}`, office);
  }
  return [...trips.values()];
}

/** How many trips a work order has (see `tripsOf`). */
export const countTrips = (entries: TripEntry[], timeZone: string, perTechnician = true, places: TripPlaces = {}) =>
  tripsOf(entries, timeZone, perTechnician, places).length;

export type TravelContext = { rule: TravelRule; timeZone: string; homes?: HomeOffices };

/** The trip rule for a work order (company + its contract), the company time zone and everyone's primary office. */
export const travelOf = (org: OrgStored & { timezone: string }, contract?: ContractStored | null, homes?: HomeOffices): TravelContext => ({
  rule: travelRuleFor(org, contract),
  timeZone: org.timezone,
  homes,
});

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * What a work order's trips cost: each trip at the cost from the office it left from, grouped per office in `lines`.
 * `perTrip` is the cost of one trip when they all cost the same (else 0). Nothing when trips aren't charged.
 */
export function travelCharge(entries: TripEntry[], places: TripPlaces | VillaPlaces["distanceKm"] | undefined, travel: TravelContext | null) {
  const where: TripPlaces = typeof places === "number" || places == null ? { villa: { distanceKm: places ?? null } } : places;
  if (!travel || !chargesTravel(travel.rule)) return { trips: 0, perTrip: 0, amount: 0, far: false, lines: [] as TripLine[] };
  const byOffice = new Map<string | null, TripLine>();
  for (const office of tripsOf(entries, travel.timeZone, travel.rule.perTechnician, { ...where, homes: where.homes ?? travel.homes })) {
    const line = byOffice.get(office);
    if (line) {
      line.trips += 1;
      continue;
    }
    const km = officeDistance(where.villa, office);
    byOffice.set(office, { officeId: office, distanceKm: km, trips: 1, perTrip: tripCost(km, travel.rule), amount: 0, far: isFar(km, travel.rule) });
  }
  const lines = [...byOffice.values()].map((l) => ({ ...l, amount: round2(l.trips * l.perTrip) }));
  const trips = lines.reduce((s, l) => s + l.trips, 0);
  const amount = round2(lines.reduce((s, l) => s + l.amount, 0));
  const same = new Set(lines.map((l) => l.perTrip)).size <= 1;
  return { trips, perTrip: same ? (lines[0]?.perTrip ?? tripCost(officeDistance(where.villa, null), travel.rule)) : 0, amount, far: lines.some((l) => l.far), lines };
}
