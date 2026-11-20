import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client", () => ({ prisma: {} }));

import { countTrips, isFar, officeDistance, travelCharge, travelOf, travelRuleFor, tripCost, tripOffice } from "@/lib/travel-charge";
import { workOrderCosts } from "@/lib/work-orders";

const org = { travelFee: "30.00", travelRadiusKm: 25, travelKmRate: "0.40", travelPerTechnician: true, timezone: "Europe/Lisbon" };
const rule = travelRuleFor(org);
const entry = (userId: string, startedAt: string, mode: "ONSITE" | "REMOTE" = "ONSITE", minutes: number | null = 60) => ({
  userId,
  startedAt: new Date(startedAt),
  mode,
  minutes,
  hourlyRate: 40,
});

describe("trip charges", () => {
  it("reads the company's rule", () => {
    expect(rule).toEqual({ fee: 30, radiusKm: 25, kmRate: 0.4, perTechnician: true, included: false });
  });

  it("charges the fixed fee within the radius (or without a distance), the rate × the whole one-way distance beyond it", () => {
    expect(tripCost(null, rule)).toBe(30);
    expect(tripCost(10, rule)).toBe(30);
    expect(tripCost(25, rule)).toBe(30); // the radius itself is still within
    expect(isFar(25, rule)).toBe(false);
    expect(tripCost(40, rule)).toBe(16); // 40 × 0.40: the whole distance, not just the 15 km past the radius
    expect(isFar(40, rule)).toBe(true);
  });

  it("counts one trip per technician per day with finished on-site time", () => {
    const entries = [
      entry("rui", "2026-10-19T09:00:00Z"),
      entry("rui", "2026-10-19T14:00:00Z"), // same day, same person: same trip
      entry("daniel", "2026-10-19T09:00:00Z", "REMOTE"), // remote: no trip
      entry("miguel", "2026-10-19T09:30:00Z"), // a second technician on site: a second trip
      entry("rui", "2026-10-20T09:00:00Z"), // next day: another trip
      entry("rui", "2026-10-21T09:00:00Z", "ONSITE", null), // running timer: not yet
    ];
    expect(countTrips(entries, "Europe/Lisbon")).toBe(3);
    // Per work order: the 19th and the 20th, however many went.
    expect(countTrips(entries, "Europe/Lisbon", false)).toBe(2);
  });

  it("splits days in the company's time zone", () => {
    // 23:30 UTC on the 19th is 00:30 on the 20th in Lisbon (summer time).
    const entries = [entry("rui", "2026-10-19T10:00:00Z"), entry("rui", "2026-10-19T23:30:00Z")];
    expect(countTrips(entries, "Europe/Lisbon")).toBe(2);
    expect(countTrips(entries, "UTC")).toBe(1);
  });

  it("uses the contract's own amounts where it sets them, and none when it includes trips", () => {
    expect(travelRuleFor(org, { travelIncluded: false, travelFee: null, travelKmRate: null })).toMatchObject({ fee: 30, kmRate: 0.4 });
    expect(travelRuleFor(org, { travelIncluded: false, travelFee: "20", travelKmRate: null })).toMatchObject({ fee: 20, kmRate: 0.4 });
    expect(travelRuleFor(org, { travelIncluded: false, travelFee: null, travelKmRate: "0" })).toMatchObject({ fee: 30, kmRate: 0 });
    expect(travelRuleFor(org, { travelIncluded: true, travelFee: "20", travelKmRate: "1" })).toMatchObject({ fee: 0, kmRate: 0, included: true });
    expect(travelRuleFor({ ...org, travelPerTechnician: false }).perTechnician).toBe(false);
  });

  it("totals trips × cost per trip, and nothing when trips aren't charged", () => {
    const entries = [entry("rui", "2026-10-19T09:00:00Z"), entry("miguel", "2026-10-19T09:00:00Z")];
    expect(travelCharge(entries, 40, travelOf(org))).toMatchObject({ trips: 2, perTrip: 16, amount: 32, far: true });
    expect(travelCharge(entries, 40, travelOf({ ...org, travelPerTechnician: false }))).toMatchObject({ trips: 1, amount: 16 });
    expect(travelCharge(entries, 40, travelOf(org, { travelIncluded: true, travelFee: null, travelKmRate: null }))).toMatchObject({ trips: 0, amount: 0 });
    expect(travelCharge(entries, null, null).amount).toBe(0);
  });

  it("adds trips to the work order's total", () => {
    const wo = {
      priority: "MEDIUM",
      timeEntries: [entry("rui", "2026-10-19T09:00:00Z"), entry("daniel", "2026-10-19T09:00:00Z", "REMOTE")],
      otherCosts: [],
      villa: { distanceKm: 10 },
    };
    const c = workOrderCosts(wo, 0, undefined, travelOf(org));
    expect(c.trips).toBe(1);
    expect(c.travel).toBe(30);
    expect(c.total).toBe(80 + 30); // 2 h × 40 + one trip
    expect(workOrderCosts(wo, 0).travel).toBe(0); // no trip rule passed
  });
});

describe("trips with offices", () => {
  // The villa is looked after by Faro (12 km); Lagos is 62 km away. 30 within 25 km, else 0.40 per km.
  const villa = {
    distanceKm: 12,
    defaultOfficeId: "faro",
    officeDistances: [
      { officeId: "faro", distanceKm: 12 },
      { officeId: "lagos", distanceKm: 62 },
    ],
  };
  const homes = new Map([
    ["rui", "faro"],
    ["miguel", "lagos"],
  ]);

  it("leaves from the office set on the job, else the person's primary office, else the villa's", () => {
    expect(tripOffice("rui", villa, [], homes)).toBe("faro");
    expect(tripOffice("miguel", villa, [], homes)).toBe("lagos");
    expect(tripOffice("miguel", villa, [{ userId: "miguel", officeId: "faro" }], homes)).toBe("faro");
    expect(tripOffice("miguel", villa, [{ userId: "miguel", officeId: null }], homes)).toBe("lagos");
    expect(tripOffice("ana", villa, [], homes)).toBe("faro"); // no office of her own
    expect(tripOffice("ana", { distanceKm: 40 }, [], homes)).toBeNull(); // nor does the villa: its own distance
  });

  it("measures from that office, falling back to the villa's own distance only for its default office", () => {
    expect(officeDistance(villa, "lagos")).toBe(62);
    expect(officeDistance(villa, null)).toBe(12);
    expect(officeDistance({ distanceKm: 30, defaultOfficeId: "faro", officeDistances: [] }, "faro")).toBe(30);
    expect(officeDistance({ distanceKm: 30, defaultOfficeId: "faro", officeDistances: [] }, "lagos")).toBeNull(); // unknown: fixed fee
    expect(officeDistance(null, "faro")).toBeNull();
  });

  it("charges the real km from a technician's office when it is beyond the radius, even if the villa's office is near", () => {
    const c = travelCharge([entry("miguel", "2026-10-19T09:00:00Z")], { villa, homes }, travelOf(org));
    expect(c).toMatchObject({ trips: 1, perTrip: 24.8, amount: 24.8, far: true });
    expect(c.lines).toEqual([{ officeId: "lagos", distanceKm: 62, trips: 1, perTrip: 24.8, amount: 24.8, far: true }]);
    // The same job done from Faro: within the radius, the fixed fee.
    expect(travelCharge([entry("rui", "2026-10-19T09:00:00Z")], { villa, homes }, travelOf(org))).toMatchObject({ amount: 30, far: false });
    // Primary offices can also come with the travel context, as the pages pass them.
    expect(travelCharge([entry("miguel", "2026-10-19T09:00:00Z")], { villa }, travelOf(org, null, homes)).amount).toBe(24.8);
  });

  it("uses the office set on the job over the primary one", () => {
    const assignees = [{ userId: "miguel", officeId: "faro" }];
    expect(travelCharge([entry("miguel", "2026-10-19T09:00:00Z")], { villa, assignees, homes }, travelOf(org)).amount).toBe(30);
  });

  it("groups each technician's trips by office", () => {
    const entries = [entry("rui", "2026-10-19T09:00:00Z"), entry("miguel", "2026-10-19T09:00:00Z"), entry("miguel", "2026-10-20T09:00:00Z")];
    const c = travelCharge(entries, { villa, homes }, travelOf(org));
    expect(c.trips).toBe(3);
    expect(c.amount).toBe(30 + 2 * 24.8);
    expect(c.perTrip).toBe(0); // they don't all cost the same
    expect(c.lines.map((l) => [l.officeId, l.trips, l.amount])).toEqual([
      ["faro", 1, 30],
      ["lagos", 2, 49.6],
    ]);
  });

  it("charges one trip per office per day when trips are per work order", () => {
    const perJob = travelOf({ ...org, travelPerTechnician: false }, null, homes);
    const entries = [
      entry("rui", "2026-10-19T09:00:00Z"),
      entry("ana", "2026-10-19T09:00:00Z"), // no office: the villa's (Faro), so she shares Rui's trip
      entry("miguel", "2026-10-19T09:00:00Z"), // from Lagos: a second trip
      entry("miguel", "2026-10-20T09:00:00Z"), // next day: a third
    ];
    expect(countTrips(entries, "Europe/Lisbon", false, { villa, homes })).toBe(3);
    expect(travelCharge(entries, { villa }, perJob)).toMatchObject({ trips: 3, amount: 30 + 2 * 24.8 });
    // Everyone from the same office: one trip a day, as before offices.
    expect(travelCharge(entries.slice(0, 2), { villa }, perJob)).toMatchObject({ trips: 1, amount: 30 });
  });

  it("charges the fixed fee when the distance from the technician's office is unknown", () => {
    const c = travelCharge([entry("miguel", "2026-10-19T09:00:00Z")], { villa: { ...villa, officeDistances: [] }, homes }, travelOf(org));
    expect(c.lines[0]).toMatchObject({ officeId: "lagos", distanceKm: null, perTrip: 30, far: false });
  });

  it("feeds the office trips into the work order's total", () => {
    const wo = { timeEntries: [entry("miguel", "2026-10-19T09:00:00Z")], otherCosts: [], villa, assignees: [{ userId: "miguel", officeId: null }] };
    const c = workOrderCosts(wo, 0, undefined, travelOf(org, null, homes));
    expect(c.travel).toBe(24.8);
    expect(c.tripLines).toHaveLength(1);
    expect(c.total).toBe(40 + 24.8);
  });
});
