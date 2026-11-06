import { describe, expect, it } from "vitest";
import { billedTime, roundUpMinutes, timeRoundingOf } from "@/lib/billing-time";

describe("billed time", () => {
  it("rounds up to whole blocks", () => {
    expect(roundUpMinutes(34, 30)).toBe(60);
    expect(roundUpMinutes(30, 30)).toBe(30);
    expect(roundUpMinutes(1, 30)).toBe(30);
    expect(roundUpMinutes(61, 60)).toBe(120);
    expect(roundUpMinutes(34, 0)).toBe(34); // no rounding
    expect(roundUpMinutes(0, 30)).toBe(0);
  });

  it("rounds each technician's total on the work order, not each entry", () => {
    const t = billedTime(
      [
        { userId: "rui", minutes: 20, hourlyRate: 40 },
        { userId: "rui", minutes: 14, hourlyRate: 40 }, // Rui: 34 min → 60
        { userId: "ana", minutes: 10, hourlyRate: 60 }, // Ana: 10 min → 30
        { userId: "ana", minutes: null, hourlyRate: 60 }, // running timer
      ],
      30,
    );
    expect(t.minutes).toBe(44);
    expect(t.billed).toBe(90);
    expect(t.people.find((p) => p.userId === "rui")).toMatchObject({ minutes: 34, billed: 60, labor: 40 });
    expect(t.people.find((p) => p.userId === "ana")).toMatchObject({ minutes: 10, billed: 30, labor: 30 });
    expect(t.labor).toBe(70);
  });

  it("rounds each day on its own, per technician", () => {
    const at = (d: string) => `2026-11-${d}T10:00:00Z`;
    const t = billedTime(
      [
        { userId: "rui", minutes: 15, hourlyRate: 60, startedAt: at("03") }, // → 30 min
        { userId: "rui", minutes: 35, hourlyRate: 60, startedAt: at("04") }, // → 1 h
        { userId: "rui", minutes: 17, hourlyRate: 60, startedAt: at("05") }, // → 30 min
        { userId: "ana", minutes: 10, hourlyRate: 60, startedAt: at("05") }, // → 30 min
      ],
      30,
      "Europe/Lisbon",
    );
    expect(t.days.map((d) => [d.userId, d.day, d.billed])).toEqual([
      ["rui", "2026-11-03", 30],
      ["rui", "2026-11-04", 60],
      ["rui", "2026-11-05", 30],
      ["ana", "2026-11-05", 30],
    ]);
    expect(t.people.find((p) => p.userId === "rui")).toMatchObject({ minutes: 67, billed: 120, labor: 120 });
    expect(t.billed).toBe(150);
    expect(t.labor).toBe(150);
  });

  it("adds up entries of the same day before rounding", () => {
    const t = billedTime(
      [
        { userId: "rui", minutes: 10, hourlyRate: 60, startedAt: "2026-11-03T09:00:00Z" },
        { userId: "rui", minutes: 10, hourlyRate: 60, startedAt: "2026-11-03T15:00:00Z" },
      ],
      30,
      "Europe/Lisbon",
    );
    expect(t.days).toHaveLength(1);
    expect(t.billed).toBe(30);
  });

  it("uses the company's calendar day, not UTC's", () => {
    const entries = [
      { userId: "rui", minutes: 20, hourlyRate: 60, startedAt: "2026-11-03T23:30:00Z" },
      { userId: "rui", minutes: 20, hourlyRate: 60, startedAt: "2026-11-04T00:30:00Z" },
    ];
    expect(billedTime(entries, 30, "UTC").billed).toBe(60); // two days
    expect(billedTime(entries, 30, "Atlantic/Azores").billed).toBe(60); // both on the 3rd: 40 min → 1 h
    expect(billedTime(entries, 30, "Atlantic/Azores").days).toHaveLength(1);
  });

  it("keeps a person's rate mix when scaling to the billed time", () => {
    // 15 min at 40 €/h + 15 min at 80 €/h = 30 min, 30 € → billed 60 min: 60 €
    const t = billedTime([{ userId: "u", minutes: 15, hourlyRate: 40 }, { userId: "u", minutes: 15, hourlyRate: 80 }], 60);
    expect(t.billed).toBe(60);
    expect(t.labor).toBeCloseTo(60);
  });

  it("falls back to 30 minutes for unknown settings", () => {
    expect(timeRoundingOf(15)).toBe(15);
    expect(timeRoundingOf(0)).toBe(0);
    expect(timeRoundingOf(45)).toBe(30);
    expect(timeRoundingOf(null)).toBe(30);
  });
});
