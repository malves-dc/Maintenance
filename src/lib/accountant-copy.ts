import "server-only";
import type { AppContext } from "@/lib/context";
import { emailConfigured } from "@/lib/email";
import { background } from "@/lib/notify";
import { mergeRecipients } from "@/lib/report-recipients";

// Accountants (the built-in Accountant role) get the PDF service report by e-mail when a job is completed, and again
// whenever a completed job's report changes, as a new revision, with "UPDATED - Revision X" in the subject. The trigger
// is lib/report-revision.ts: completing a job, or producing a report whose content changed since. Sent after the
// response, so completing a job doesn't wait for the PDF and the e-mails.

type CopyCtx = Pick<AppContext, "db" | "organization" | "user">;

/** The accountants' addresses: active, not erased. */
export async function accountantAddresses(db: CopyCtx["db"]) {
  const rows = await db.membership.findMany({
    where: { active: true, role: "ACCOUNTANT", erasedAt: null, user: { erasedAt: null } },
    select: { user: { select: { name: true, email: true } } },
  });
  return mergeRecipients(rows.map((r) => ({ email: r.user.email, name: r.user.name, source: "company" as const }))).map((r) => r.email);
}

/** Sends the accountants their copy in the background, when the report was just fingerprinted or revised. */
export function copyReportToAccountants(ctx: CopyCtx, workOrderId: string, changed: "first" | "raised" | null) {
  if (!changed) return;
  background(async () => {
    if (!(await emailConfigured())) return;
    const to = await accountantAddresses(ctx.db);
    if (!to.length) return;
    // Imported here: report-email renders the report, which is where this is called from too.
    const { sendServiceReport } = await import("@/lib/report-email");
    await sendServiceReport(ctx, workOrderId, to, { updated: changed === "raised", auto: true });
  });
}
