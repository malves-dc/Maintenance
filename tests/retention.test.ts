import { describe, expect, it } from "vitest";
import { cutoffs, monthsBefore, parseRetention, RETENTION_DEFAULTS, retentionNoticeLines } from "@/lib/retention-rules";

describe("retention settings", () => {
  it("falls back to the defaults for missing or invalid values", () => {
    expect(parseRetention(null)).toEqual(RETENTION_DEFAULTS);
    expect(parseRetention({ notificationsDays: 30, auditMonths: -1, requestersMonths: 1.5, chatMonths: "6" })).toEqual({
      ...RETENTION_DEFAULTS,
      notificationsDays: 30,
    });
    expect(parseRetention({ auditMonths: 999 }).auditMonths).toBe(RETENTION_DEFAULTS.auditMonths); // above the 10-year cap
    expect(parseRetention({ chatMonths: 0, notificationsDays: 0 })).toMatchObject({ chatMonths: 0, notificationsDays: 0 });
  });

  it("goes back whole months, clamping to the end of shorter months", () => {
    expect(monthsBefore(new Date("2026-10-14T03:00:00Z"), 24).toISOString()).toBe("2024-10-14T03:00:00.000Z");
    expect(monthsBefore(new Date("2026-03-31T00:00:00Z"), 1).toISOString()).toBe("2026-02-28T00:00:00.000Z");
    expect(monthsBefore(new Date("2026-01-15T00:00:00Z"), 2).toISOString()).toBe("2025-11-15T00:00:00.000Z");
  });

  it("gives no cut-off for periods set to 0 (keep forever)", () => {
    const now = new Date("2026-10-14T00:00:00Z");
    const c = cutoffs({ notificationsDays: 90, auditMonths: 0, requestersMonths: 12, chatMonths: 0, formerMonths: 0 }, now);
    expect(c.notifications?.toISOString()).toBe("2026-07-16T00:00:00.000Z");
    expect(c.audit).toBeNull();
    expect(c.requesters?.toISOString()).toBe("2025-10-14T00:00:00.000Z");
    expect(c.chat).toBeNull();
    expect(c.former).toBeNull();
  });

  it("keeps chat for 24 months and flags former members and clients after 24 months by default", () => {
    expect(RETENTION_DEFAULTS).toMatchObject({ chatMonths: 24, formerMonths: 24 });
    expect(cutoffs(RETENTION_DEFAULTS, new Date("2026-11-13T00:00:00Z")).former?.toISOString()).toBe("2024-11-13T00:00:00.000Z");
  });

  it("lists in the privacy notice only the periods that delete something", () => {
    const lines = retentionNoticeLines({ ...RETENTION_DEFAULTS, auditMonths: 0, chatMonths: 12 });
    expect(lines.map((l) => l.key)).toEqual(["notificationsDays", "requestersMonths", "chatMonths", "pushDays"]);
    expect(lines.find((l) => l.key === "chatMonths")?.n).toBe(12);
  });
});
