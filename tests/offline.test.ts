import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client", () => ({ prisma: {} }));

import { applyOps, missingRequired, PENDING_PHOTO } from "@/lib/offline/apply";
import { clampAt } from "@/lib/wo-ops";
import { qrTokenOf } from "@/components/scanner";
import type { OfflineItem, OfflineWorkOrder, QueuedOp, Snapshot } from "@/lib/offline-types";

const item = (id: string, type: OfflineItem["type"], required = false): OfflineItem => ({
  id,
  type,
  label: id,
  description: null,
  required,
  options: [],
  unit: null,
  value: null,
  note: null,
  completedBy: null,
});

const wo: OfflineWorkOrder = {
  id: "w1",
  number: "2026-7",
  title: "Replace AP",
  description: null,
  status: "OPEN",
  priority: "HIGH",
  type: "REACTIVE",
  dueDate: null,
  villa: null,
  area: null,
  asset: null,
  items: [item("h", "HEADING", true), item("check", "CHECKBOX", true), item("photo", "PHOTO", true), item("note", "TEXT")],
  comments: [],
  minutesLogged: 30,
  signOff: null,
  clientAbsent: false,
  workReport: null,
};
const snap: Snapshot = { at: "2026-09-28T10:00:00Z", user: { id: "u", name: "Rui" }, workOrders: [wo], assets: [], members: [] };
const at = "2026-09-28T11:00:00Z";

describe("client sign-off offline", () => {
  it("shows a signature captured on the device as pending, then signed once synced", () => {
    const pending = applyOps(snap, [{ id: "s", kind: "photo", woId: "w1", itemId: null, blobKey: "sig", filename: "signature.png", signOffName: "Maria", at }], "Rui")[0];
    expect(pending.signOff).toEqual({ name: "Maria", at, pending: true });
    expect(pending.items.every((i) => !i.value)).toBe(true); // not a checklist answer
    const signed = applyOps(snap, [{ id: "s", kind: "signoff", woId: "w1", name: "Maria", attachmentId: "att", at }], "Rui")[0];
    expect(signed.signOff).toEqual({ name: "Maria", at });
  });

  it("client absent replaces the signature, and signing clears it", () => {
    const absent = applyOps(snap, [{ id: "a", kind: "clientAbsent", woId: "w1", absent: true, at }], "Rui")[0];
    expect(absent.clientAbsent).toBe(true);
    const thenSigned = applyOps(snap, [
      { id: "a", kind: "clientAbsent", woId: "w1", absent: true, at },
      { id: "s", kind: "signoff", woId: "w1", name: "Maria", attachmentId: "att", at },
    ], "Rui")[0];
    expect(thenSigned.clientAbsent).toBe(false);
    // Once signed, "absent" can't be set (the server refuses it too).
    const signedSnap = { ...snap, workOrders: [{ ...wo, signOff: { name: "Maria", at } }] };
    expect(applyOps(signedSnap, [{ id: "a", kind: "clientAbsent", woId: "w1", absent: true, at }], "Rui")[0].clientAbsent).toBe(false);
  });
});

describe("work report offline", () => {
  it("shows the queued report (trimmed; blank clears it)", () => {
    const r = applyOps(snap, [{ id: "r", kind: "report", woId: "w1", text: "  Replaced the AP.  ", at }], "Rui")[0];
    expect(r.workReport).toBe("Replaced the AP.");
    const cleared = applyOps(snap, [
      { id: "r", kind: "report", woId: "w1", text: "Replaced the AP.", at },
      { id: "r2", kind: "report", woId: "w1", text: " ", at },
    ], "Rui")[0];
    expect(cleared.workReport).toBeNull();
    expect(snap.workOrders[0].workReport).toBeNull(); // the snapshot itself is untouched
  });
});

describe("applyOps (offline overlay)", () => {
  it("lays queued changes over the snapshot without mutating it", () => {
    const ops: QueuedOp[] = [
      { id: "1", kind: "answer", woId: "w1", itemId: "check", value: "true", at },
      { id: "2", kind: "photo", woId: "w1", itemId: "photo", blobKey: "b1", filename: "a.jpg", at },
      { id: "3", kind: "comment", woId: "w1", body: "On site", at },
      { id: "4", kind: "time", woId: "w1", startedAt: "2026-09-28T09:00:00Z", endedAt: "2026-09-28T09:45:00Z", at },
      { id: "5", kind: "answer", woId: "missing", itemId: "x", value: "y", at }, // unknown WO: ignored
    ];
    const [w] = applyOps(snap, ops, "Rui");
    expect(w.items.find((i) => i.id === "check")?.value).toBe("true");
    expect(w.items.find((i) => i.id === "photo")?.value).toBe(`${PENDING_PHOTO}b1`);
    expect(w.items.find((i) => i.id === "check")?.completedBy).toBe("Rui");
    expect(w.comments.at(-1)?.body).toBe("On site");
    expect(w.minutesLogged).toBe(75);
    expect(w.status).toBe("IN_PROGRESS"); // answering starts the job, like the server does
    expect(snap.workOrders[0].items[1].value).toBeNull();
  });

  it("applies status changes in order", () => {
    const ops: QueuedOp[] = [
      { id: "1", kind: "status", woId: "w1", status: "ON_HOLD", at },
      { id: "2", kind: "status", woId: "w1", status: "IN_PROGRESS", at },
    ];
    expect(applyOps(snap, ops, "Rui")[0].status).toBe("IN_PROGRESS");
  });

  it("lists required steps still missing (headings never block)", () => {
    expect(missingRequired(wo).map((i) => i.id)).toEqual(["check", "photo"]);
    const [done] = applyOps(
      snap,
      [
        { id: "1", kind: "answer", woId: "w1", itemId: "check", value: "true", at },
        { id: "2", kind: "photo", woId: "w1", itemId: "photo", blobKey: "b", filename: "p.jpg", at },
      ],
      "Rui",
    );
    expect(missingRequired(done)).toEqual([]);
  });

  it("treats an unticked checkbox as missing", () => {
    const [w] = applyOps(snap, [{ id: "1", kind: "answer", woId: "w1", itemId: "check", value: "false", at }], "Rui");
    expect(missingRequired(w).map((i) => i.id)).toContain("check");
  });
});

describe("clampAt", () => {
  const now = new Date("2026-09-28T12:00:00Z");
  it("keeps device times in the past 30 days, never in the future", () => {
    expect(clampAt("2026-09-28T09:00:00Z", now).toISOString()).toBe("2026-09-28T09:00:00.000Z");
    expect(clampAt("2026-10-01T00:00:00Z", now)).toEqual(now);
    expect(clampAt("2020-01-01T00:00:00Z", now).toISOString()).toBe("2026-08-29T12:00:00.000Z");
    expect(clampAt("not a date", now)).toEqual(now);
  });
});

describe("qrTokenOf", () => {
  it("reads the token from an asset-label URL only", () => {
    expect(qrTokenOf("https://app.example.com/r/cmuh6tn9t000au8h3z31i2m8m")).toBe("cmuh6tn9t000au8h3z31i2m8m");
    expect(qrTokenOf("https://app.example.com/assets/cmuh6tn9t000au8h3z31i2m8m")).toBeNull();
    expect(qrTokenOf("5901234123457")).toBeNull();
  });
});
