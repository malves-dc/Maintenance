// Notification types and per-user channel preferences. No server imports: the profile page's
// client form uses these too.

export const NOTIFICATION_TYPES = [
  "WO_ASSIGNED",
  "WO_STATUS",
  "WO_COMMENT",
  "MENTION",
  "MESSAGE",
  "REQUEST_NEW",
  "REQUEST_UPDATE",
  "REQUEST_MESSAGE",
  "REQUEST_PHOTOS",
  "METER_ALERT",
  "LOW_STOCK",
  "PO_APPROVAL",
  "PO_UPDATE",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export type Channels = { email: boolean; push: boolean };

/** Defaults per type. Chat messages skip the in-app list (the Messages badge covers them). */
export const NOTIFICATION_DEFAULTS: Record<NotificationType, Channels & { inApp: boolean }> = {
  WO_ASSIGNED: { inApp: true, email: true, push: true },
  WO_STATUS: { inApp: true, email: false, push: true },
  WO_COMMENT: { inApp: true, email: false, push: true },
  MENTION: { inApp: true, email: true, push: true },
  MESSAGE: { inApp: false, email: false, push: true },
  REQUEST_NEW: { inApp: true, email: true, push: true },
  REQUEST_UPDATE: { inApp: true, email: true, push: true },
  REQUEST_MESSAGE: { inApp: true, email: false, push: true },
  REQUEST_PHOTOS: { inApp: true, email: false, push: true },
  METER_ALERT: { inApp: true, email: true, push: true },
  LOW_STOCK: { inApp: true, email: false, push: true },
  PO_APPROVAL: { inApp: true, email: true, push: true },
  PO_UPDATE: { inApp: true, email: false, push: true },
};

/** Types each audience can receive, for the preferences screen. */
export const PORTAL_TYPES: NotificationType[] = ["REQUEST_UPDATE", "REQUEST_MESSAGE", "WO_STATUS"];

/** A user's effective channels for a type: their saved choice, else the default. */
export function prefsOf(stored: unknown, type: NotificationType): Channels {
  const d = NOTIFICATION_DEFAULTS[type];
  const s = stored && typeof stored === "object" ? (stored as Record<string, Partial<Channels> | undefined>)[type] : undefined;
  return { email: typeof s?.email === "boolean" ? s.email : d.email, push: typeof s?.push === "boolean" ? s.push : d.push };
}
