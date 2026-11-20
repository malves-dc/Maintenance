import { describe, expect, it } from "vitest";
import { addDays, checkEntry, formatMinutes, isDay, parseDuration, timerEntry, weekStart, withinEditWindow, type EntryRules } from "@/lib/timesheet-rules";

const rules: EntryRules = { today: "2026-11-20", editDays: 7, manager: false, otherMinutes: 0 };
const ok = (r: ReturnType<typeof checkEntry>) => ("entry" in r ? r.entry : null);
const error = (r: ReturnType<typeof checkEntry>) => ("error" in r ? r.error : null);

describe("hours: days", () => {
  it("reads only real days", () => {
    expect(isDay("2026-11-20")).toBe(true);
    expect(isDay("2026-02-30")).toBe(false);
    expect(isDay("20/11/2026")).toBe(false);
  });
  it("finds the Monday and moves across months", () => {
    expect(weekStart("2026-11-20")).toBe("2026-11-16"); // Friday
    expect(weekStart("2026-11-16")).toBe("2026-11-16");
    expect(weekStart("2026-11-22")).toBe("2026-11-16"); // Sunday belongs to the week before
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
  });
  it("keeps one's own past days open for the edit window only", () => {
    expect(withinEditWindow("2026-11-13", "2026-11-20", 7, false)).toBe(true);
    expect(withinEditWindow("2026-11-12", "2026-11-20", 7, false)).toBe(false);
    expect(withinEditWindow("2026-11-19", "2026-11-20", 0, false)).toBe(false);
    expect(withinEditWindow("2025-01-01", "2026-11-20", 7, true)).toBe(true);
  });
});

describe("hours: an entry", () => {
  it("takes start and end minus the break", () => {
    const e = ok(checkEntry({ date: "2026-11-20", startTime: "08:00", endTime: "17:00", breakMinutes: 60, description: " Quadro elétrico " }, rules));
    expect(e).toEqual({ date: "2026-11-20", startTime: "08:00", endTime: "17:00", minutes: 480, description: "Quadro elétrico" });
  });
  it("takes a duration without times", () => {
    expect(ok(checkEntry({ date: "2026-11-20", minutes: 90, description: "x" }, rules))?.minutes).toBe(90);
  });
  it("refuses what doesn't add up", () => {
    expect(error(checkEntry({ date: "2026-11-20", startTime: "10:00", endTime: "09:00", description: "x" }, rules))).toBe("endBeforeStart");
    expect(error(checkEntry({ date: "2026-11-20", startTime: "09:00", endTime: "10:00", breakMinutes: 60, description: "x" }, rules))).toBe("breakTooLong");
    expect(error(checkEntry({ date: "2026-11-20", endTime: "10:00", minutes: 60, description: "x" }, rules))).toBe("start");
    expect(error(checkEntry({ date: "2026-11-20", startTime: "25:00", endTime: "26:00", description: "x" }, rules))).toBe("start");
    expect(error(checkEntry({ date: "2026-11-20", minutes: 0, description: "x" }, rules))).toBe("minutes");
    expect(error(checkEntry({ date: "2026-11-20", minutes: 60, description: "  " }, rules))).toBe("description");
  });
  it("keeps a person's day within 24 hours, counting their other time", () => {
    expect(error(checkEntry({ date: "2026-11-20", minutes: 120, description: "x" }, { ...rules, otherMinutes: 1400 }))).toBe("dayOver24");
    expect(ok(checkEntry({ date: "2026-11-20", minutes: 40, description: "x" }, { ...rules, otherMinutes: 1400 }))?.minutes).toBe(40);
  });
  it("stops people logging future or closed days, but not managers", () => {
    expect(error(checkEntry({ date: "2026-11-21", minutes: 60, description: "x" }, rules))).toBe("future");
    expect(error(checkEntry({ date: "2026-11-01", minutes: 60, description: "x" }, rules))).toBe("locked");
    expect(ok(checkEntry({ date: "2026-11-01", minutes: 60, description: "x" }, { ...rules, manager: true }))).not.toBeNull();
    expect(ok(checkEntry({ date: "2026-11-23", minutes: 60, description: "x" }, { ...rules, manager: true }))).not.toBeNull();
  });
});

describe("hours: typed durations", () => {
  it("reads the usual ways of writing hours", () => {
    expect(parseDuration("8")).toBe(480);
    expect(parseDuration("7:30")).toBe(450);
    expect(parseDuration("7h30")).toBe(450);
    expect(parseDuration("7h")).toBe(420);
    expect(parseDuration("7,5")).toBe(450);
    expect(parseDuration("7.25")).toBe(435);
    expect(parseDuration("45min")).toBe(45);
    expect(parseDuration(" 1 : 05 ")).toBe(65);
  });
  it("refuses the rest", () => {
    expect(parseDuration("")).toBeNull();
    expect(parseDuration("7:75")).toBeNull();
    expect(parseDuration("abc")).toBeNull();
  });
  it("formats minutes", () => {
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(480)).toBe("8h");
    expect(formatMinutes(455)).toBe("7h 35");
  });
});

describe("hours: the timer", () => {
  it("logs the day and times it ran in the company's time zone", () => {
    // 14:05 → 16:35 UTC is 14:05 → 16:35 in Lisbon in November (WET).
    expect(timerEntry(new Date("2026-11-20T14:05:10Z"), new Date("2026-11-20T16:35:40Z"), "Europe/Lisbon")).toEqual({
      date: "2026-11-20",
      startTime: "14:05",
      endTime: "16:35",
      minutes: 151,
    });
  });
  it("leaves the end blank when it ran past midnight, and drops runs under a minute", () => {
    const e = timerEntry(new Date("2026-07-01T21:30:00Z"), new Date("2026-07-01T23:30:00Z"), "Europe/Lisbon"); // 22:30 → 00:30 WEST
    expect(e).toMatchObject({ date: "2026-07-01", startTime: "22:30", endTime: null, minutes: 120 });
    expect(timerEntry(new Date("2026-11-20T10:00:00Z"), new Date("2026-11-20T10:00:20Z"), "Europe/Lisbon")).toBeNull();
  });
});
