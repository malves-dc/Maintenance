import { getFormatter, getTranslations } from "next-intl/server";
import { getContext } from "@/lib/context";
import { csvResponse, toCsv } from "@/lib/csv";
import { auditWhere, categoryOf } from "@/lib/audit-filter";
import { auditText } from "@/lib/audit-text";
import { audit } from "@/lib/audit";

const MAX_ROWS = 50_000;

/** The audit log with the page's filters, as CSV (newest first). */
export async function GET(req: Request) {
  const ctx = await getContext();
  if (!ctx.can("audit.view")) return new Response("Not found", { status: 404 });
  const t = await getTranslations();
  const text = auditText(t, await getFormatter());
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const entries = await ctx.db.auditLog.findMany({
    where: auditWhere(params, ctx.organization.timezone),
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: MAX_ROWS,
  });
  const header = [t("audit.when"), t("audit.user"), t("audit.category"), t("audit.what"), t("audit.entity"), t("audit.target"), t("audit.detailsColumn"), t("audit.ip")];
  const rows = entries.map((e) => [
    e.createdAt.toISOString(),
    e.user ? `${e.user.name} <${e.user.email}>` : e.userId ? t("audit.removedUser") : t("audit.system"),
    t(`audit.categories.${categoryOf(e)}`),
    text.action(e),
    text.entityTitle(e.entityType),
    text.label(e),
    text
      .details(e)
      .map((d) => `${d.field}: ${d.before !== undefined ? `${d.before} → ` : ""}${d.after}`)
      .join("; "),
    e.ip,
  ]);
  // The log holds names, e-mails and IP addresses: taking a copy out is itself logged.
  await audit(ctx, "audit.export", "Organization", ctx.organization.id, { rows: entries.length });
  return csvResponse(`audit_${new Date().toISOString().slice(0, 10)}.csv`, toCsv(header, rows));
}
