import { describe, expect, it } from "vitest";
import { localDay, manualInterval } from "@/lib/offline/manual-time";

const now = new Date(2026, 10, 16, 15, 30); // 16 Nov 2026, 15:30 local

describe("field app: minutes typed by hand", () => {
  it("ends today's time now", () => {
    const r = manualInterval(localDay(now), 90, now)!;
    expect(r.endedAt).toEqual(now);
    expect(r.startedAt).toEqual(new Date(2026, 10, 16, 14, 0));
  });

  it("starts an earlier day's time at 09:00", () => {
    const r = manualInterval("2026-11-14", 45, now)!;
    expect(r.startedAt).toEqual(new Date(2026, 10, 14, 9, 0));
    expect(r.endedAt).toEqual(new Date(2026, 10, 14, 9, 45));
  });

  it("never ends after now", () => {
    const late = new Date(2026, 10, 17, 2, 0); // yesterday + 24 h would reach the future
    const r = manualInterval("2026-11-16", 1440, late)!;
    expect(r.endedAt).toEqual(late);
    expect((r.endedAt.getTime() - r.startedAt.getTime()) / 60_000).toBe(1440);
  });

  it("refuses future days and bad minutes", () => {
    expect(manualInterval("2026-11-17", 30, now)).toBeNull();
    expect(manualInterval(localDay(now), 0, now)).toBeNull();
    expect(manualInterval(localDay(now), 1441, now)).toBeNull();
    expect(manualInterval(localDay(now), 1.5, now)).toBeNull();
    expect(manualInterval("", 30, now)).toBeNull();
  });
});
