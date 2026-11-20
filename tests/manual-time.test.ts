import { describe, expect, it } from "vitest";
import { clockInterval, formatDuration, localDay, localTime } from "@/lib/offline/manual-time";

const now = new Date(2026, 10, 16, 15, 30); // 16 Nov 2026, 15:30 local

describe("time typed as clock-in and clock-out", () => {
  it("takes the day and both times in local time", () => {
    const r = clockInterval("2026-11-16", "09:15", "12:45", now);
    expect(r).toEqual({ startedAt: new Date(2026, 10, 16, 9, 15), endedAt: new Date(2026, 10, 16, 12, 45), minutes: 210, overnight: false });
  });

  it("ends the next day when the clock-out is earlier than the clock-in", () => {
    const r = clockInterval("2026-11-14", "22:30", "01:15", now);
    expect(r).toEqual({ startedAt: new Date(2026, 10, 14, 22, 30), endedAt: new Date(2026, 10, 15, 1, 15), minutes: 165, overnight: true });
  });

  it("allows a clock-out of right now, not later", () => {
    expect(clockInterval("2026-11-16", "14:00", "15:30", now)).toMatchObject({ minutes: 90 });
    expect(clockInterval("2026-11-16", "14:00", "15:31", now)).toEqual({ error: "future" });
    expect(clockInterval("2026-11-17", "08:00", "09:00", now)).toEqual({ error: "future" });
    expect(clockInterval("2026-11-16", "15:00", "01:00", now)).toEqual({ error: "future" }); // overnight into tomorrow
  });

  it("refuses equal or missing times", () => {
    expect(clockInterval("2026-11-16", "10:00", "10:00", now)).toEqual({ error: "same" });
    expect(clockInterval("2026-11-16", "", "10:00", now)).toEqual({ error: "incomplete" });
    expect(clockInterval("", "09:00", "10:00", now)).toEqual({ error: "incomplete" });
    expect(clockInterval("2026-11-16", "9:00", "10:00", now)).toEqual({ error: "incomplete" });
  });

  it("formats local days, times and durations", () => {
    expect(localDay(now)).toBe("2026-11-16");
    expect(localTime(new Date(2026, 0, 2, 7, 5))).toBe("07:05");
    expect(formatDuration(45)).toBe("45m");
    expect(formatDuration(125)).toBe("2h 05m");
  });
});
