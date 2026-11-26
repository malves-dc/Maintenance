import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client", () => ({ prisma: {} }));

import { canChangePrep, prepCost, prepRateOf } from "@/lib/prep-time";
import { defaultPermissions } from "@/lib/rbac";
import { workOrderCosts } from "@/lib/work-orders";

describe("preparation time", () => {
  it("is charged at the company's Technician rate", () => {
    expect(prepRateOf({ roleRates: { TECHNICIAN: 40, MANAGER: 60 } })).toBe(40);
    expect(prepRateOf({ roleRates: null })).toBe(0);
    expect(prepCost(15, 40)).toBe(10);
    expect(prepCost(null, 40)).toBe(0);
  });

  it("adds to labour and the total, unrounded and outside the urgent surcharge", () => {
    // 34 min logged at 40 €/h, billed as 60 min = 40 €; 15 min preparation = 10 €; urgent 20% of 40 € = 8 €
    const c = workOrderCosts(
      { priority: "URGENT", prepMinutes: 15, timeEntries: [{ userId: "u", minutes: 34, hourlyRate: 40 }], otherCosts: [] },
      30,
      { fee: 0, percent: 20 },
      null,
      40,
    );
    expect(c.prep).toBe(10);
    expect(c.prepMinutes).toBe(15);
    expect(c.labor).toBe(50);
    expect(c.billedMinutes).toBe(60); // the technicians' time only
    expect(c.urgent).toBe(8);
    expect(c.total).toBe(58);
  });

  it("can be changed by assigned technicians on open jobs and by permission holders until invoiced", () => {
    const base = { hasPermission: false, canExecute: true, assigned: true, closed: false, invoiced: false };
    expect(canChangePrep(base)).toBe(true);
    expect(canChangePrep({ ...base, assigned: false })).toBe(false); // another technician's job
    expect(canChangePrep({ ...base, closed: true })).toBe(false);
    expect(canChangePrep({ ...base, assigned: false, hasPermission: true, closed: true })).toBe(true); // accountant on a done job
    expect(canChangePrep({ ...base, hasPermission: true, invoiced: true })).toBe(false);
  });

  it("is a Super Admin, administrator and accountant permission by default", () => {
    expect(defaultPermissions("ADMIN")).toContain("workOrders.prepTime");
    expect(defaultPermissions("ACCOUNTANT")).toContain("workOrders.prepTime");
    expect(defaultPermissions("MANAGER")).not.toContain("workOrders.prepTime");
    expect(defaultPermissions("TECHNICIAN")).not.toContain("workOrders.prepTime");
  });
});
