// Who gets e-mailed a service report, besides the client. Pure: shared by settings, the work-order page,
// the send action and tests.
//  - Company-wide (Settings → Organization): staff members, roles (built-in or custom "job:<id>") and addresses.
//  - Per client (client page): contacts marked "receives reports", and extra addresses.
//  - Per send: the sender ticks/unticks these and can add more addresses.

export type CompanyRecipients = { userIds: string[]; roles: string[]; emails: string[] };
export type RecipientSource = "client" | "contact" | "clientExtra" | "company" | "previous";
export type Recipient = { email: string; name: string | null; source: RecipientSource };

export const MAX_EXTRA = 20;
const EMAIL = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]{2,}$/;

export const isEmail = (s: string) => EMAIL.test(s) && s.length <= 254;

/** Addresses typed one per line (or separated by commas/semicolons): valid ones, lower-cased and unique, plus the invalid ones. */
export function parseEmailList(text: string): { emails: string[]; invalid: string[] } {
  const parts = text.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
  const emails = [...new Set(parts.filter(isEmail).map((s) => s.toLowerCase()))];
  return { emails, invalid: parts.filter((s) => !isEmail(s)) };
}

const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export function parseCompanyRecipients(raw: unknown): CompanyRecipients {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return { userIds: strings(o.userIds), roles: strings(o.roles), emails: strings(o.emails).filter(isEmail) };
}

/** One entry per address (first source wins, so the client stays labelled as the client); erased accounts dropped. */
export function mergeRecipients(...lists: Recipient[][]): Recipient[] {
  const seen = new Map<string, Recipient>();
  for (const r of lists.flat()) {
    const email = r.email.trim().toLowerCase();
    if (!isEmail(email) || email.endsWith(".invalid") || seen.has(email)) continue;
    seen.set(email, { ...r, email });
  }
  return [...seen.values()];
}
