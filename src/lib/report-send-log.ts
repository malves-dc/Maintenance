// The send history of a work order's service report: each time it was e-mailed, by whom, to whom and when, and which
// revision. Built from ReportSend (one row per address; the rows of one send share sentAt, by and revision).

export type SendRow = { email: string; sentAt: Date; auto: boolean; revision: number | null; sentBy: { name: string } | null };
export type SendEntry = { at: Date; by: string | null; auto: boolean; revision: number | null; to: string[] };

/** One entry per send, newest first, its addresses in the order they were sent. */
export function groupSends(rows: SendRow[]): SendEntry[] {
  const out = new Map<string, SendEntry>();
  for (const r of rows) {
    const key = [r.sentAt.toISOString(), r.sentBy?.name ?? "", r.auto, r.revision ?? ""].join("|");
    const e = out.get(key) ?? { at: r.sentAt, by: r.sentBy?.name ?? null, auto: r.auto, revision: r.revision, to: [] };
    if (!e.to.includes(r.email)) e.to.push(r.email);
    out.set(key, e);
  }
  return [...out.values()].sort((a, b) => b.at.getTime() - a.at.getTime());
}

/** What to select from ReportSend for groupSends. */
export const SEND_LOG_SELECT = { email: true, sentAt: true, auto: true, revision: true, sentBy: { select: { name: true } } } as const;
