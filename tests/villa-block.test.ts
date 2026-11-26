import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// The scheduler reads schedules and organizations through the raw client and writes the work order through the
// tenant client: both are faked here, with one schedule on a blocked villa.
const villa = { id: "v1", name: "Villa QL7", blockedAt: new Date("2026-11-20T10:00:00Z") as Date | null };
const schedule = {
  id: "pm1",
  organizationId: "org1",
  title: "Quarterly check",
  description: null,
  priority: "MEDIUM",
  system: null,
  villaId: "v1",
  assetId: null,
  teamId: null,
  procedureId: null,
  estimatedMinutes: null,
  leadDays: 0,
  createdById: "u1",
  frequency: "MONTHLY",
  interval: 1,
  daysOfWeek: [],
  startDate: new Date("2026-01-01T00:00:00Z"),
  endDate: null,
  nextDueAt: new Date("2026-11-25T00:00:00Z") as Date | null,
  active: true,
  trigger: "TIME",
  assignees: [],
  organization: { timezone: "Europe/Lisbon" },
};
const updates: unknown[] = [];
const created: unknown[] = [];
const notified: { ids: string[]; n: { type: string; data: Record<string, unknown> } }[] = [];

vi.mock("@/lib/db/client", () => ({
  prisma: {
    pMSchedule: {
      findMany: async () => [schedule],
      updateMany: async (a: { data: { nextDueAt: Date | null } }) => {
        updates.push(a.data);
        return { count: 1 };
      },
      update: async (a: unknown) => {
        updates.push(a);
        return {};
      },
    },
    organization: { findUnique: async () => ({ id: "org1", name: "Demo", timezone: "Europe/Lisbon", roleRates: null }) },
    membership: { findFirst: async () => ({ user: { id: "u1", name: "Miguel" } }) },
  },
}));
vi.mock("@/lib/db/tenant", () => ({
  tenantDb: () => ({
    villa: { findUnique: async () => villa },
    team: { count: async () => 1 },
    procedure: { count: async () => 1 },
    membership: { findMany: async () => [{ userId: "manager1" }, { userId: "manager2" }] },
    workOrder: {
      create: async (a: unknown) => {
        created.push(a);
        return { id: "wo1", year: 2026, number: 1, title: "x", clientVisible: false, villaId: "v1" };
      },
    },
  }),
  assertOwned: async () => {},
  nextSeriesNumber: async () => 1,
}));
vi.mock("@/lib/notify", () => ({
  notify: async (_actor: unknown, ids: string[], n: { type: string; data: Record<string, unknown> }) => {
    notified.push({ ids, n });
  },
  notifyExternal: async () => {},
  membersWith: async () => ["admin1"],
}));

import { runDueSchedules } from "@/lib/pm";
import { assertVillaNotBlocked, WorkOrderError } from "@/lib/work-orders";

beforeEach(() => {
  updates.length = 0;
  created.length = 0;
  notified.length = 0;
  schedule.nextDueAt = new Date("2026-11-25T00:00:00Z");
  villa.blockedAt = new Date("2026-11-20T10:00:00Z");
});

describe("blocked villa", () => {
  it("refuses new work orders", async () => {
    const db = { villa: { findUnique: async () => villa } } as never;
    await expect(assertVillaNotBlocked({ db }, "v1")).rejects.toThrow(WorkOrderError);
    await expect(assertVillaNotBlocked({ db }, "v1")).rejects.toMatchObject({ code: "villaBlocked" });
    await expect(assertVillaNotBlocked({ db }, null)).resolves.toBeUndefined(); // a job with no villa
    villa.blockedAt = null;
    await expect(assertVillaNotBlocked({ db }, "v1")).resolves.toBeUndefined();
  });

  it("skips a preventive occurrence, moves the schedule on and e-mails the managers", async () => {
    const res = await runDueSchedules({ now: new Date("2026-11-25T08:00:00Z") });
    expect(res).toMatchObject({ created: 0, blocked: 1 });
    expect(created).toHaveLength(0);
    // The claim (next occurrence) stands: no roll-back to the skipped date, so it isn't retried every run.
    expect(updates).toHaveLength(1);
    expect((updates[0] as { nextDueAt: Date }).nextDueAt.getTime()).toBeGreaterThan(new Date("2026-11-25T00:00:00Z").getTime());
    expect(notified).toEqual([
      { ids: ["manager1", "manager2"], n: expect.objectContaining({ type: "PM_BLOCKED", data: { villa: "Villa QL7", schedule: "Quarterly check", due: "2026-11-25" } }) },
    ]);
  });
});
