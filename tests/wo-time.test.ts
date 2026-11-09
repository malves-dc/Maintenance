import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { canLogTime, withoutTime } from "@/lib/wo-time";
import { reportFilename, reportFingerprint, type ReportContent } from "@/lib/report-revision";

describe("who logs time", () => {
  it("is the people assigned to the job, never the owner", () => {
    expect(canLogTime("TECHNICIAN", true)).toBe(true);
    expect(canLogTime("MANAGER", true)).toBe(true);
    expect(canLogTime("TECHNICIAN", false)).toBe(false);
    expect(canLogTime("OWNER", true)).toBe(false);
    expect(canLogTime("OWNER", false)).toBe(false);
  });

  it("finds who has no time yet; a running timer counts, as it stops on completion", () => {
    const people = [{ userId: "rui" }, { userId: "ana" }];
    expect(withoutTime(people, [])).toEqual(people);
    expect(withoutTime(people, [{ userId: "rui", minutes: 20, endedAt: new Date() }])).toEqual([{ userId: "ana" }]);
    expect(withoutTime(people, [{ userId: "rui", minutes: 20 }, { userId: "ana", minutes: null, endedAt: null }])).toEqual([]);
    // Two entries, on different visits, are fine; someone else's time isn't yours.
    expect(withoutTime(people, [{ userId: "rui", minutes: 5 }, { userId: "rui", minutes: 9 }, { userId: "owner", minutes: 17 }])).toEqual([{ userId: "ana" }]);
  });
});

describe("report fingerprint (the service report's revision)", () => {
  const job = (over: Partial<ReportContent> = {}): ReportContent => ({
    status: "DONE",
    reportRevision: 0,
    reportFingerprint: null,
    title: "Rack",
    workReport: "Replaced the switch.",
    assignees: [{ userId: "a" }, { userId: "b" }],
    items: [{ id: "1", value: "true" }],
    timeEntries: [{ id: "t1", minutes: 30 }],
    parts: [{ id: "p1", quantity: "2.00" }],
    attachments: [{ id: "x" }, { id: "y" }],
    ...over,
  });

  it("ignores row order, the job's status and the stored revision", () => {
    expect(reportFingerprint(job({ assignees: [{ userId: "b" }, { userId: "a" }], attachments: [{ id: "y" }, { id: "x" }] }))).toBe(reportFingerprint(job()));
    expect(reportFingerprint(job({ status: "IN_PROGRESS", reportRevision: 3, reportFingerprint: "abc" }))).toBe(reportFingerprint(job()));
    expect(reportFingerprint(job({ parts: [{ id: "p1", quantity: 2 }] }))).toBe(reportFingerprint(job()));
  });

  it("changes when what the report shows changes", () => {
    const base = reportFingerprint(job());
    expect(reportFingerprint(job({ timeEntries: [{ id: "t1", minutes: 30 }, { id: "t2", minutes: 17 }] }))).not.toBe(base);
    expect(reportFingerprint(job({ workReport: "Replaced the switch and the UPS." }))).not.toBe(base);
    expect(reportFingerprint(job({ attachments: [{ id: "x" }] }))).not.toBe(base);
  });

  it("names the PDF after the revision", () => {
    expect(reportFilename("2026-4", 0)).toBe("WO-2026-4.pdf");
    expect(reportFilename("2026-4", 2)).toBe("WO-2026-4-rev2.pdf");
  });
});
