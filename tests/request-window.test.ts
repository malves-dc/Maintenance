import { describe, expect, it } from "vitest";
import { canReschedule, needsConfirmedSlot, slotInWindow, slotText, windowError } from "../src/lib/request-window";
import en from "../messages/en.json";
import pt from "../messages/pt.json";

const now = new Date("2026-11-04T10:00:00Z");
const at = (iso: string) => new Date(iso);

describe("client availability window", () => {
  it("is optional", () => {
    expect(windowError({ availableFrom: null, availableTo: null }, now)).toBeNull();
    expect(needsConfirmedSlot({ availableFrom: null, availableTo: null })).toBe(false);
  });

  it("needs both ends", () => {
    expect(windowError({ availableFrom: at("2026-11-05T09:00:00Z"), availableTo: null }, now)).toEqual({ field: "availableTo", code: "windowIncomplete" });
    expect(windowError({ availableFrom: null, availableTo: at("2026-11-05T09:00:00Z") }, now)).toEqual({ field: "availableFrom", code: "windowIncomplete" });
  });

  it("ends after it starts, in the future, within a year", () => {
    const from = at("2026-11-05T09:00:00Z");
    expect(windowError({ availableFrom: from, availableTo: from }, now)?.code).toBe("windowOrder");
    expect(windowError({ availableFrom: from, availableTo: at("2026-11-05T08:00:00Z") }, now)?.code).toBe("windowOrder");
    expect(windowError({ availableFrom: at("2026-11-01T09:00:00Z"), availableTo: at("2026-11-03T18:00:00Z") }, now)?.code).toBe("windowPast");
    expect(windowError({ availableFrom: from, availableTo: at("2027-12-01T09:00:00Z") }, now)?.code).toBe("windowTooLong");
    expect(windowError({ availableFrom: from, availableTo: at("2026-11-07T18:00:00Z") }, now)).toBeNull();
    // Already started but not over yet: still fine.
    expect(windowError({ availableFrom: at("2026-11-03T09:00:00Z"), availableTo: at("2026-11-06T18:00:00Z") }, now)).toBeNull();
  });

  it("requires a confirmed visit once given", () => {
    expect(needsConfirmedSlot({ availableFrom: at("2026-11-05T09:00:00Z"), availableTo: at("2026-11-07T18:00:00Z") })).toBe(true);
  });

  it("tells whether the visit falls inside the window", () => {
    const w = { availableFrom: at("2026-11-05T09:00:00Z"), availableTo: at("2026-11-07T18:00:00Z") };
    expect(slotInWindow(at("2026-11-05T09:00:00Z"), w)).toBe(true);
    expect(slotInWindow(at("2026-11-06T14:30:00Z"), w)).toBe(true);
    expect(slotInWindow(at("2026-11-07T18:00:00Z"), w)).toBe(true);
    expect(slotInWindow(at("2026-11-05T08:59:00Z"), w)).toBe(false);
    expect(slotInWindow(at("2026-11-08T09:00:00Z"), w)).toBe(false);
    expect(slotInWindow(at("2026-11-08T09:00:00Z"), { availableFrom: null, availableTo: null })).toBe(true);
  });

  it("lets the visit move until the job is finished", () => {
    expect(canReschedule("APPROVED", "OPEN")).toBe(true);
    expect(canReschedule("APPROVED", "ON_HOLD")).toBe(true);
    expect(canReschedule("APPROVED", "IN_PROGRESS")).toBe(true);
    expect(canReschedule("APPROVED", "DONE")).toBe(false);
    expect(canReschedule("APPROVED", "CANCELLED")).toBe(false);
    expect(canReschedule("APPROVED", null)).toBe(false); // work order deleted
    expect(canReschedule("DECLINED", null)).toBe(false);
  });

  it("writes the visit in the company's time zone for notifications", () => {
    expect(slotText(at("2026-11-05T14:30:00Z"), "Europe/Lisbon")).toBe("05/11/2026, 14:30");
    expect(slotText(at("2026-07-05T14:30:00Z"), "Europe/Lisbon")).toBe("05/07/2026, 15:30");
  });

  it("has a message for every error code", () => {
    for (const code of ["windowIncomplete", "windowOrder", "windowPast", "windowTooLong", "slotRequired"]) {
      expect(en.validation).toHaveProperty(code);
      expect(pt.validation).toHaveProperty(code);
    }
  });
});
