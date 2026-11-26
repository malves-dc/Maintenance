import { describe, expect, it } from "vitest";
import { prepRateFor, type PrepAssignee } from "@/lib/prep-time";
import { costArgs, currentPrices, parsePrices, pricesOf } from "@/lib/work-order-prices";

const org = {
  timeRounding: 30,
  urgentFee: "50.00",
  urgentPercent: 20,
  travelFee: "45.00",
  travelRadiusKm: 25,
  travelKmRate: "0.40",
  travelPerTechnician: false,
  roleRates: { TECHNICIAN: 45, MANAGER: 55, OWNER: 70 },
  timezone: "Europe/Lisbon",
};
const rates = { TECHNICIAN: 45, MANAGER: 55, OWNER: 70 };

const tech = (over: Partial<PrepAssignee> = {}): PrepAssignee => ({ role: null, jobRole: null, member: { role: "TECHNICIAN" }, ...over });

describe("preparation rate", () => {
  it("is the assigned technician's rate on the job", () => {
    expect(prepRateFor([tech()], rates, 45)).toBe(45);
    // Took the Engineer role on this job
    expect(prepRateFor([tech({ jobRole: { access: "TECHNICIAN", hourlyRate: "60" } })], rates, 45)).toBe(60);
  });

  it("is the highest rate when several are assigned", () => {
    expect(prepRateFor([tech(), tech({ member: { role: "MANAGER" } }), tech({ jobRole: { access: "TECHNICIAN", hourlyRate: 50 } })], rates, 45)).toBe(55);
  });

  it("leaves out the Super Admin and former members, falling back to the Technician rate", () => {
    expect(prepRateFor([tech({ member: { role: "OWNER" } }), tech({ member: null })], rates, 45)).toBe(45);
    expect(prepRateFor([], rates, 45)).toBe(45);
  });
});

describe("work order prices", () => {
  it("are today's settings while the job is open", () => {
    const p = pricesOf(org, { status: "IN_PROGRESS", prices: null }, 60);
    expect(p).toEqual(currentPrices(org, null, 60));
    expect(p.block).toBe(30);
    expect(p.urgent).toEqual({ fee: 50, percent: 20 });
    expect(p.travel).toMatchObject({ fee: 45, kmRate: 0.4, radiusKm: 25, perTechnician: false, included: false });
    expect(p.prepRate).toBe(60);
  });

  it("are the saved ones once completed, whatever the settings say now", () => {
    const saved = currentPrices(org, null, 45);
    const later = { ...org, timeRounding: 60, urgentFee: "80.00", travelFee: "60.00", roleRates: { TECHNICIAN: 90 } };
    expect(pricesOf(later, { status: "DONE", prices: JSON.parse(JSON.stringify(saved)) }, 90)).toEqual(saved);
    const [block, urgent, travel, prepRate] = costArgs(later, { status: "DONE", prices: saved }, undefined, 90);
    expect([block, urgent.fee, travel.rule.fee, prepRate]).toEqual([30, 50, 45, 45]);
  });

  it("follow the settings again when the job is reopened, and ignore unreadable saved prices", () => {
    const saved = currentPrices(org, null, 45);
    expect(pricesOf({ ...org, travelFee: "60.00" }, { status: "IN_PROGRESS", prices: saved }, 45).travel.fee).toBe(60);
    expect(parsePrices({ block: 30 })).toBeNull();
    expect(parsePrices(null)).toBeNull();
    expect(pricesOf(org, { status: "DONE", prices: { block: "x" } }, 45)).toEqual(currentPrices(org, null, 45));
  });

  it("keep a contract's own surcharge and included trips", () => {
    const contract = { urgentFee: "0", urgentPercent: null, travelIncluded: true, travelFee: null, travelKmRate: null };
    const p = currentPrices(org, contract, 45);
    expect(p.urgent).toEqual({ fee: 0, percent: 0 });
    expect(p.travel).toMatchObject({ fee: 0, kmRate: 0, included: true });
  });
});
