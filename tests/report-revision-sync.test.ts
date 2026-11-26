import { describe, expect, it, vi } from "vitest";

// syncReportRevision says what changed, so the accountants get their copy once: on completion ("first") and on
// each new revision ("raised"), never when nothing changed or another request got there first.

vi.mock("server-only", () => ({}));

const { syncReportRevision, reportFingerprint } = await import("@/lib/report-revision");

const content = { title: "Rack", assignees: [], items: [], timeEntries: [], parts: [], attachments: [] };

function db(row: Record<string, unknown> | null, updated = 1) {
  const updateMany = vi.fn().mockResolvedValue({ count: updated });
  return { db: { workOrder: { findUnique: vi.fn().mockResolvedValue(row), updateMany } } as never, updateMany };
}

describe("syncReportRevision", () => {
  it("fingerprints a just-completed job without raising the revision", async () => {
    const { db: d, updateMany } = db({ ...content, status: "DONE", reportRevision: 0, reportFingerprint: null });
    expect(await syncReportRevision(d, "wo")).toEqual({ revision: 0, changed: "first" });
    expect(updateMany).toHaveBeenCalledOnce();
  });

  it("raises the revision when a completed job's content changed", async () => {
    const { db: d } = db({ ...content, title: "Rack v2", status: "DONE", reportRevision: 1, reportFingerprint: "old" });
    expect(await syncReportRevision(d, "wo")).toEqual({ revision: 2, changed: "raised" });
  });

  it("changes nothing when the content is the same", async () => {
    const row = { ...content, status: "DONE", reportRevision: 1 };
    const { db: d, updateMany } = db({ ...row, reportFingerprint: reportFingerprint(row as never) });
    expect(await syncReportRevision(d, "wo")).toEqual({ revision: 1, changed: null });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("reports no change when another request raised it first, or the job isn't done", async () => {
    const { db: raced } = db({ ...content, status: "DONE", reportRevision: 1, reportFingerprint: "old" }, 0);
    expect((await syncReportRevision(raced, "wo")).changed).toBeNull();
    const { db: open } = db({ ...content, status: "IN_PROGRESS", reportRevision: 0, reportFingerprint: null });
    expect(await syncReportRevision(open, "wo")).toEqual({ revision: 0, changed: null });
  });
});
