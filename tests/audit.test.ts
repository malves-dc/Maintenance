import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  auditLog: { create: vi.fn(async () => ({})) },
  workOrder: { findFirst: vi.fn(), findMany: vi.fn() },
  attachment: { findFirst: vi.fn(), findMany: vi.fn() },
  membership: { findMany: vi.fn(async () => []) },
  user: { findMany: vi.fn<(a: { where: { id: { in: string[] } } }) => Promise<{ id: string; name: string }[]>>(async () => []) },
  category: { findMany: vi.fn(async () => []) },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client", () => ({ prisma: db }));

import { changesOf, MASK } from "@/lib/audit";
import { withAuditTrail } from "@/lib/db/audit-trail";
import { auditWhere, categoryOf, dayStart } from "@/lib/audit-filter";

const decimal = (s: string) => ({ toFixed: () => s, toString: () => s, constructor: { name: "Decimal" } });

describe("field changes", () => {
  it("keeps only fields that really changed, with old and new values", () => {
    const before = { title: "Router down", status: "OPEN", dueDate: new Date("2026-10-01T00:00:00Z"), unitCost: decimal("10.5"), updatedAt: new Date() };
    const { changes, relations } = changesOf(before, {
      title: "Router down",
      status: "IN_PROGRESS",
      dueDate: new Date("2026-10-02T00:00:00Z"),
      unitCost: "10.50",
      updatedAt: new Date(),
    });
    expect(changes).toEqual({ status: ["OPEN", "IN_PROGRESS"], dueDate: ["2026-10-01T00:00:00.000Z", "2026-10-02T00:00:00.000Z"] });
    expect(relations).toEqual([]);
  });

  it("leaves out the villa internet check's results, but not its settings", () => {
    const before = { online: false, onlineCheckedAt: new Date("2026-10-30T09:00:00Z"), connectivityPort: 80 };
    const { changes } = changesOf(before, { online: true, onlineCheckedAt: new Date(), onlineLatencyMs: 12, connectivityPort: null });
    expect(changes).toEqual({ connectivityPort: [80, null] });
  });

  it("never stores secret values, and names the relations an update touched", () => {
    const { changes, relations } = changesOf(
      { credentialsEnc: "old-cipher", name: "NVR" },
      { credentialsEnc: "new-cipher", assignees: { deleteMany: {}, create: [] }, quantity: { increment: 2 } },
    );
    expect(changes.credentialsEnc).toEqual([MASK, MASK]);
    expect(JSON.stringify(changes)).not.toContain("cipher");
    expect(relations).toEqual(["assignees"]);
    expect(changes.quantity).toEqual([null, '{"increment":2}']);
  });
});

describe("audit trail", () => {
  const actor = { userId: "u1", ip: "10.0.0.1" };
  beforeEach(() => vi.clearAllMocks());

  it("logs an update with the changed fields and the record's name", async () => {
    db.workOrder.findFirst.mockResolvedValue({ id: "wo1", number: 7, title: "Router down", status: "OPEN", priority: "LOW" });
    const result = await withAuditTrail("org1", actor, "WorkOrder", "update", { where: { id: "wo1" }, data: { status: "DONE", priority: "LOW" } }, async () => ({ id: "wo1" }));
    expect(result).toEqual({ id: "wo1" });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org1",
        userId: "u1",
        ip: "10.0.0.1",
        action: "workOrder.update",
        entityType: "WorkOrder",
        entityId: "wo1",
        meta: { label: "#7 Router down", changes: { status: ["OPEN", "DONE"] } },
      }),
    });
  });

  it("shows replaced relations as names before → after, and drops ones that didn't change", async () => {
    db.workOrder.findFirst.mockResolvedValue({ id: "wo1", number: 1, title: "T", assignees: [{ id: "a1", userId: "u1" }], categories: [{ id: "c1" }] });
    db.user.findMany.mockImplementation(async ({ where }: { where: { id: { in: string[] } } }) =>
      [{ id: "u1", name: "Rui" }, { id: "u2", name: "Ana" }].filter((u) => where.id.in.includes(u.id)),
    );
    await withAuditTrail(
      "org1",
      actor,
      "WorkOrder",
      "update",
      { where: { id: "wo1" }, data: { assignees: { deleteMany: {}, create: [{ userId: "u1" }, { userId: "u2" }] }, categories: { set: [{ id: "c1" }] }, items: { deleteMany: {}, create: [{ label: "x", meterId: null }] } } },
      async () => ({}),
    );
    const meta = (db.auditLog.create.mock.calls[0] as unknown as [{ data: { meta: Record<string, unknown> } }])[0].data.meta;
    expect(meta.changes).toEqual({ assignees: [["Rui"], ["Ana", "Rui"]] });
    expect(meta.relations).toEqual(["items"]);
  });

  it("skips updates that change nothing, and only logs deletions of attachments", async () => {
    db.workOrder.findFirst.mockResolvedValue({ id: "wo1", status: "OPEN" });
    await withAuditTrail("org1", actor, "WorkOrder", "update", { where: { id: "wo1" }, data: { status: "OPEN" } }, async () => ({}));
    await withAuditTrail("org1", actor, "Attachment", "create", { data: { filename: "a.jpg" } }, async () => ({ id: "a1" }));
    expect(db.auditLog.create).not.toHaveBeenCalled();

    db.attachment.findMany.mockResolvedValue([{ id: "a1", filename: "a.jpg" }]);
    await withAuditTrail("org1", actor, "Attachment", "deleteMany", { where: { id: "a1" } }, async () => ({ count: 1 }));
    expect(db.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "attachment.delete", entityId: "a1", meta: { label: "a.jpg" } }) });
  });

  it("still returns the write's result when logging fails", async () => {
    db.workOrder.findFirst.mockResolvedValue({ id: "wo1", status: "OPEN" });
    db.auditLog.create.mockRejectedValueOnce(new Error("db down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(withAuditTrail("org1", actor, "WorkOrder", "delete", { where: { id: "wo1" } }, async () => ({ id: "wo1" }))).resolves.toEqual({ id: "wo1" });
    spy.mockRestore();
  });

  it("does not log models outside the trail", async () => {
    await withAuditTrail("org1", actor, "StockMovement", "create", { data: {} }, async () => ({ id: "m1" }));
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });
});

describe("filters", () => {
  it("turns a day into its midnight in the company's time zone", () => {
    expect(dayStart("2026-07-15", "Europe/Lisbon")?.toISOString()).toBe("2026-07-14T23:00:00.000Z"); // summer time
    expect(dayStart("2026-01-15", "Europe/Lisbon")?.toISOString()).toBe("2026-01-15T00:00:00.000Z");
    expect(dayStart("15/01/2026", "Europe/Lisbon")).toBeNull();
  });

  it("files each entry under one category", () => {
    expect(categoryOf({ action: "auth.signInFailed", entityType: "User" })).toBe("security");
    expect(categoryOf({ action: "server.unlockFailed", entityType: "Server" })).toBe("security");
    expect(categoryOf({ action: "server.backupDownload", entityType: "Server" })).toBe("server");
    expect(categoryOf({ action: "membership.update", entityType: "Membership" })).toBe("users");
    expect(categoryOf({ action: "workOrder.delete", entityType: "WorkOrder" })).toBe("records");
  });

  it("builds the date range as whole days", () => {
    const where = auditWhere({ from: "2026-01-10", to: "2026-01-10", userId: "system" }, "Europe/Lisbon");
    expect(where.AND).toEqual(
      expect.arrayContaining([
        { userId: null },
        { createdAt: { gte: new Date("2026-01-10T00:00:00.000Z") } },
        { createdAt: { lt: new Date("2026-01-11T00:00:00.000Z") } },
      ]),
    );
  });
});
