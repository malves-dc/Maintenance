// Storage limitation (GDPR art. 5(1)(e)): how long each kind of record is kept. Per company, set in
// Settings → Organization; 0 keeps the records forever. Pure so the rules can be unit-tested.

export type Retention = {
  /** In-app notifications. */
  notificationsDays: number;
  /** Security log (secret views, erasures). */
  auditMonths: number;
  /** Name/e-mail/phone typed into the public QR form, counted from when the request was decided. */
  requestersMonths: number;
  /** Chat messages (DMs, groups, team channels). Work-order comments are job records and are kept. */
  chatMonths: number;
  /** Deactivated members and archived clients: after this, they're listed for erasure (never erased on their own,
   *  since only a person can tell whether something still needs their data, e.g. an open dispute). */
  formerMonths: number;
};

export const RETENTION_DEFAULTS: Retention = { notificationsDays: 90, auditMonths: 24, requestersMonths: 24, chatMonths: 24, formerMonths: 24 };
export const RETENTION_KEYS = Object.keys(RETENTION_DEFAULTS) as (keyof Retention)[];
/** Upper bound of each setting (10 years), so a typo can't overflow date maths. */
export const RETENTION_MAX: Retention = { notificationsDays: 3650, auditMonths: 120, requestersMonths: 120, chatMonths: 120, formerMonths: 120 };

/** Fixed periods for technical records nobody needs to tune. */
export const SYNC_LOG_DAYS = 30;
export const EXPIRED_INVITE_DAYS = 30;
/** Devices registered for push whose user has had no access, or hasn't opened the app, for this long. */
export const PUSH_IDLE_DAYS = 180;

export function parseRetention(raw: unknown): Retention {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out = { ...RETENTION_DEFAULTS };
  for (const k of RETENTION_KEYS) {
    const v = o[k];
    if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= RETENTION_MAX[k]) out[k] = v;
  }
  return out;
}

export const daysBefore = (now: Date, days: number) => new Date(now.getTime() - days * 86_400_000);

/** Same day of month `months` earlier (clamped to the month's last day). */
export function monthsBefore(now: Date, months: number) {
  const d = new Date(now);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

/** Cut-off dates for one company: records created (or decided) before them go; null = keep forever. */
export function cutoffs(r: Retention, now: Date) {
  return {
    notifications: r.notificationsDays ? daysBefore(now, r.notificationsDays) : null,
    audit: r.auditMonths ? monthsBefore(now, r.auditMonths) : null,
    requesters: r.requestersMonths ? monthsBefore(now, r.requestersMonths) : null,
    chat: r.chatMonths ? monthsBefore(now, r.chatMonths) : null,
    former: r.formerMonths ? monthsBefore(now, r.formerMonths) : null,
  };
}

/** Lines of the privacy notice's retention section: one per period that is on (0 = kept, so not listed). */
export function retentionNoticeLines(r: Retention): { key: keyof Retention | "pushDays"; n: number }[] {
  const keys: (keyof Retention)[] = ["notificationsDays", "auditMonths", "requestersMonths", "chatMonths"];
  return [...keys.filter((k) => r[k] > 0).map((k) => ({ key: k, n: r[k] })), { key: "pushDays" as const, n: PUSH_IDLE_DAYS }];
}
