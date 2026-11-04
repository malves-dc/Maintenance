import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client", () => ({ prisma: {} }));

import { changeStatus, hasWorkReport, isItemComplete, isSignedOff, workOrderCosts, type WoCtx } from "@/lib/work-orders";
import { setWorkReport } from "@/lib/wo-ops";

describe("isItemComplete", () => {
  it("treats headings as complete and unchecked boxes as incomplete", () => {
    expect(isItemComplete({ type: "HEADING", value: null })).toBe(true);
    expect(isItemComplete({ type: "CHECKBOX", value: "false" })).toBe(false);
    expect(isItemComplete({ type: "CHECKBOX", value: "true" })).toBe(true);
  });

  it("requires a non-blank value for other types", () => {
    expect(isItemComplete({ type: "TEXT", value: "  " })).toBe(false);
    expect(isItemComplete({ type: "PASS_FAIL", value: "FAIL" })).toBe(true);
    expect(isItemComplete({ type: "PASS_FAIL", value: "NA" })).toBe(true);
    expect(isItemComplete({ type: "NUMBER", value: "0" })).toBe(true);
  });
});

describe("workOrderCosts", () => {
  it("sums labour at each entry's snapshotted rate plus other costs", () => {
    const c = workOrderCosts({
      timeEntries: [
        { minutes: 90, hourlyRate: "40" },
        { minutes: 30, hourlyRate: 60 },
        { minutes: null, hourlyRate: 50 }, // running timer: not counted
      ],
      otherCosts: [{ amount: "25.50" }],
    }, 0);
    expect(c.minutes).toBe(120);
    expect(c.labor).toBe(90);
    expect(c.total).toBeCloseTo(115.5);
  });

  it("bills each technician's time rounded up to the company's period", () => {
    const c = workOrderCosts(
      {
        timeEntries: [
          { userId: "rui", minutes: 34, hourlyRate: 40 }, // → 60 min, 40 €
          { userId: "ana", minutes: 30, hourlyRate: 60 }, // → 30 min, 30 €
        ],
        otherCosts: [],
      },
      30,
    );
    expect(c.minutes).toBe(64);
    expect(c.billedMinutes).toBe(90);
    expect(c.labor).toBe(70);
  });
});

describe("isSignedOff (required to complete a job)", () => {
  it("needs the client's signature or client absent", () => {
    expect(isSignedOff({ signatureUrl: null, clientAbsent: false })).toBe(false);
    expect(isSignedOff({ signatureUrl: "att1", clientAbsent: false })).toBe(true);
    expect(isSignedOff({ signatureUrl: null, clientAbsent: true })).toBe(true);
  });
});

describe("work report (required to complete a job)", () => {
  it("needs some text, not just spaces", () => {
    expect(hasWorkReport({ workReport: null })).toBe(false);
    expect(hasWorkReport({ workReport: "  \n " })).toBe(false);
    expect(hasWorkReport({ workReport: "Replaced the PoE switch." })).toBe(true);
  });

  /** A context whose database holds one work order; `update` records what would be written. */
  function fakeCtx(wo: Record<string, unknown>) {
    const update = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...wo, ...data }));
    const db = {
      workOrder: { findUnique: async () => wo, update },
      timeEntry: { findMany: async () => [] },
    };
    return { ctx: { db, organization: { id: "org" }, user: { id: "u", name: "Rui" } } as unknown as WoCtx, update };
  }
  const base = { id: "w1", status: "IN_PROGRESS", items: [], signatureUrl: null, clientAbsent: true, firstResponseAt: null };

  it("blocks Done without a report, after the required checklist items", async () => {
    await expect(changeStatus(fakeCtx({ ...base, workReport: null }).ctx, "w1", "DONE")).rejects.toMatchObject({ code: "reportRequired" });
    await expect(changeStatus(fakeCtx({ ...base, workReport: " " }).ctx, "w1", "DONE")).rejects.toMatchObject({ code: "reportRequired" });
    const items = [{ type: "CHECKBOX", value: null, required: true }];
    await expect(changeStatus(fakeCtx({ ...base, items, workReport: null }).ctx, "w1", "DONE")).rejects.toMatchObject({ code: "requiredItems" });
    // Other moves don't need it.
    const { ctx, update } = fakeCtx({ ...base, workReport: null });
    await changeStatus(ctx, "w1", "ON_HOLD").catch(() => {}); // notifications aren't wired in the fake
    expect(update).toHaveBeenCalled();
  });

  it("is saved trimmed, empty clears it, and it is locked once the job is closed", async () => {
    const open = fakeCtx({ status: "IN_PROGRESS", workReport: null });
    await setWorkReport(open.ctx, "w1", "  Rewired the rack.  ");
    expect(open.update).toHaveBeenCalledWith({ where: { id: "w1" }, data: { workReport: "Rewired the rack." } });
    const filled = fakeCtx({ status: "IN_PROGRESS", workReport: "x" });
    await setWorkReport(filled.ctx, "w1", "   ");
    expect(filled.update).toHaveBeenCalledWith({ where: { id: "w1" }, data: { workReport: null } });
    for (const status of ["DONE", "CANCELLED"]) {
      const closed = fakeCtx({ status, workReport: "x" });
      await expect(setWorkReport(closed.ctx, "w1", "changed")).rejects.toMatchObject({ code: "locked" });
      expect(closed.update).not.toHaveBeenCalled();
    }
  });
});
