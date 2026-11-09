import { describe, expect, it } from "vitest";
import { docRef, parseDocRef, seriesYear } from "@/lib/series";

describe("yearly series", () => {
  it("shows year and number", () => {
    expect(docRef({ year: 2026, number: 12 })).toBe("2026-12");
  });

  it("takes the year in the company's time zone", () => {
    const newYear = new Date("2027-01-01T00:30:00Z");
    expect(seriesYear("Europe/Lisbon", newYear)).toBe(2027);
    expect(seriesYear("America/New_York", newYear)).toBe(2026);
  });

  it("reads what people type", () => {
    expect(parseDocRef("2026-12", 2027)).toEqual({ year: 2026, number: 12 });
    expect(parseDocRef(" #2026 - 12 ", 2027)).toEqual({ year: 2026, number: 12 });
    expect(parseDocRef("2026/12", 2027)).toEqual({ year: 2026, number: 12 });
    expect(parseDocRef("12", 2027)).toEqual({ year: 2027, number: 12 });
    expect(parseDocRef("#12", 2027)).toEqual({ year: 2027, number: 12 });
  });

  it("refuses anything else", () => {
    for (const text of ["", "router", "2026-", "-12", "26-12", "0", "2026-0", "12.5"]) expect(parseDocRef(text, 2027)).toBeNull();
  });
});
