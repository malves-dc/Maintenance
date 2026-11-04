// Rules for the period a client says the work can be done in, and the visit time confirmed to them.

export type AvailabilityWindow = { availableFrom: Date | null; availableTo: Date | null };

/** Longest window a client can give. */
export const MAX_WINDOW_DAYS = 365;
const DAY = 86_400_000;

/**
 * Checks a client's window: both ends or neither, the end after the start and not already over.
 * Returns the field that is wrong and a `validation.*` code, or null when it is fine.
 */
export function windowError(w: AvailabilityWindow, now = new Date()): { field: "availableFrom" | "availableTo"; code: string } | null {
  const { availableFrom: from, availableTo: to } = w;
  if (!from && !to) return null;
  if (!from) return { field: "availableFrom", code: "windowIncomplete" };
  if (!to) return { field: "availableTo", code: "windowIncomplete" };
  if (to.getTime() <= from.getTime()) return { field: "availableTo", code: "windowOrder" };
  if (to.getTime() <= now.getTime()) return { field: "availableTo", code: "windowPast" };
  if (to.getTime() - from.getTime() > MAX_WINDOW_DAYS * DAY) return { field: "availableTo", code: "windowTooLong" };
  return null;
}

/** A request with a window can't be approved until someone confirms the visit date and time. */
export function needsConfirmedSlot(w: AvailabilityWindow) {
  return !!(w.availableFrom || w.availableTo);
}

/** Whether a confirmed visit falls inside the client's window (staff get a warning when it doesn't). */
export function slotInWindow(slot: Date, w: AvailabilityWindow) {
  if (w.availableFrom && slot.getTime() < w.availableFrom.getTime()) return false;
  if (w.availableTo && slot.getTime() > w.availableTo.getTime()) return false;
  return true;
}

/** The visit can be confirmed or moved until the job is finished or cancelled. */
export function canReschedule(status: "PENDING" | "APPROVED" | "DECLINED", woStatus: string | null | undefined) {
  if (status === "PENDING") return true;
  return status === "APPROVED" && !!woStatus && woStatus !== "DONE" && woStatus !== "CANCELLED";
}

/** "dd/mm/yyyy, hh:mm" in the company's time zone, for notification text (stored as plain strings). */
export function slotText(d: Date, timeZone: string) {
  return new Intl.DateTimeFormat("pt-PT", { timeZone, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
}
