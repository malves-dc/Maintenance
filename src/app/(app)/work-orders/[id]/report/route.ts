import { getContext } from "@/lib/context";
import { renderServiceReport } from "@/lib/service-report";
import { portalScopes } from "@/lib/portal-scope";
import { reportFilename } from "@/lib/report-revision";

export async function GET(_req: Request, { params }: RouteContext<"/work-orders/[id]/report">) {
  const { id } = await params;
  const ctx = await getContext();
  // Staff, or a client-portal user for a client-visible WO on a villa they can reach: one they own, or one their
  // company manages for another owner (the same rule as the portal, lib/portal-scope.ts).
  const portalScope =
    ctx.role === "REQUESTER" && ctx.membership.clientId ? portalScopes(ctx.membership.clientId, ctx.user.id).workOrderWhere : null;
  if (!ctx.can("internal.view") && !portalScope) return new Response("Not found", { status: 404 });

  const report = await renderServiceReport(ctx, { id, ...(ctx.can("internal.view") ? {} : portalScope) });
  if (!report) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(report.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${reportFilename(report.number, report.revision)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
