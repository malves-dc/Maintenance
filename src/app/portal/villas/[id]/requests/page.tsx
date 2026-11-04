import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { CalendarCheck, ChevronRight, FileDown, Plus } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { WorkOrderStatusBadge } from "@/components/badges";
import { RequestStatusBadge } from "@/components/request-badge";
import { getPortalContext } from "@/lib/portal";
import type { RequestStatus, WorkOrderStatus } from "@/generated/prisma/enums";

const LIMIT = 100;

type Row = {
  key: string;
  title: string;
  at: Date;
  kind: string;
  visit: Date | null; // confirmed visit of a request whose job is still to be done
  href: string | null; // the request's own page
  request: RequestStatus | null;
  workOrder: { id: string; status: WorkOrderStatus } | null;
};

/**
 * Everything asked and done at one property, newest first: the client's requests (with the job they became)
 * and the other jobs shared with the client (preventive visits…). Finished jobs have their service report.
 */
export default async function PortalVillaRequestsPage({ params }: PageProps<"/portal/villas/[id]/requests">) {
  const { id } = await params;
  const ctx = await getPortalContext();
  const t = await getTranslations();
  const format = await getFormatter();

  const villa = await ctx.db.villa.findFirst({ where: { id, ...ctx.villaWhere }, select: { id: true, name: true } });
  if (!villa) notFound();

  const [requests, jobs] = await Promise.all([
    ctx.db.request.findMany({
      where: { ...ctx.requestWhere, villaId: villa.id },
      select: { id: true, number: true, title: true, status: true, createdAt: true, scheduledFor: true, workOrder: { select: { id: true, status: true, clientVisible: true, completedAt: true } } },
      orderBy: { createdAt: "desc" },
      take: LIMIT,
    }),
    ctx.db.workOrder.findMany({
      where: { ...ctx.workOrderWhere, villaId: villa.id, request: { is: null } },
      select: { id: true, title: true, type: true, status: true, createdAt: true, completedAt: true },
      orderBy: { createdAt: "desc" },
      take: LIMIT,
    }),
  ]);

  const rows: Row[] = [
    ...requests.map((r) => {
      const wo = r.workOrder?.clientVisible ? r.workOrder : null;
      return {
        key: `r:${r.id}`,
        title: r.title,
        at: wo?.completedAt ?? r.createdAt,
        kind: t("portal.requestNumber", { number: r.number }),
        href: `/portal/requests/${r.id}`,
        visit: r.status === "APPROVED" && r.workOrder?.status !== "DONE" && r.workOrder?.status !== "CANCELLED" ? r.scheduledFor : null,
        request: r.status,
        workOrder: wo ? { id: wo.id, status: wo.status } : null,
      };
    }),
    ...jobs.map((w) => ({
      key: `w:${w.id}`,
      title: w.title,
      at: w.completedAt ?? w.createdAt,
      kind: t(`woType.${w.type}`),
      href: null,
      visit: null,
      request: null,
      workOrder: { id: w.id, status: w.status },
    })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  return (
    <>
      <BackLink href={`/portal/villas/${villa.id}`} label={villa.name} />
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t("portal.pastRequests")}</h1>
          <p className="text-sm text-muted">{villa.name}</p>
        </div>
        <Link href={`/portal/requests/new?villaId=${villa.id}`}>
          <Button variant="secondary">
            <Plus className="size-4" />
            {t("portal.newRequest")}
          </Button>
        </Link>
      </div>

      {rows.length === 0 ? (
        <Card className="p-5 text-sm text-muted">{t("portal.noPastRequests")}</Card>
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {rows.map((r) => {
              const body = (
                <span className="min-w-0">
                  <span className="block truncate font-medium">{r.title}</span>
                  <span className="text-xs text-muted">
                    {r.kind} · {format.dateTime(r.at, { dateStyle: "medium" })}
                    {r.visit && (
                      <span className="ml-1 inline-flex items-center gap-1 font-medium text-green-700">
                        · <CalendarCheck className="size-3" />
                        {t("portal.visitOn", { date: format.dateTime(r.visit, { dateStyle: "medium", timeStyle: "short" }) })}
                      </span>
                    )}
                  </span>
                </span>
              );
              const done = r.workOrder?.status === "DONE";
              return (
                <li key={r.key} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  {r.href ? (
                    <Link href={r.href} className="min-w-0 flex-1 hover:text-brand">
                      {body}
                    </Link>
                  ) : (
                    <span className="min-w-0 flex-1">{body}</span>
                  )}
                  <span className="flex shrink-0 items-center gap-3">
                    {done && (
                      <Link
                        href={`/report/${r.workOrder!.id}`}
                        prefetch={false}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-brand hover:border-brand"
                      >
                        <FileDown className="size-3.5" />
                        {t("portal.report")}
                      </Link>
                    )}
                    {r.workOrder ? <WorkOrderStatusBadge status={r.workOrder.status} /> : r.request && <RequestStatusBadge status={r.request} />}
                    {r.href && <ChevronRight className="hidden size-4 text-muted sm:block" />}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}
