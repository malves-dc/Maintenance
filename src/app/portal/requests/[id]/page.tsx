import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { CheckCircle2, Circle, FileDown, XCircle } from "lucide-react";
import { Card } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { WorkOrderStatusBadge } from "@/components/badges";
import { getPortalContext } from "@/lib/portal";
import { fileUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";

export default async function PortalRequestPage({ params }: PageProps<"/portal/requests/[id]">) {
  const { id } = await params;
  const ctx = await getPortalContext();
  const t = await getTranslations();
  const format = await getFormatter();

  const r = await ctx.db.request.findFirst({
    where: { id, ...ctx.requestWhere },
    include: {
      villa: { select: { id: true, name: true } },
      asset: { select: { name: true } },
      attachments: { orderBy: { createdAt: "asc" } },
      workOrder: {
        select: {
          id: true,
          number: true,
          status: true,
          clientVisible: true,
          dueDate: true,
          completedAt: true,
          signedByName: true,
          workReport: true,
          assignees: { select: { user: { select: { name: true } } } },
        },
      },
    },
  });
  if (!r) notFound();
  const wo = r.workOrder?.clientVisible ? r.workOrder : null;
  const dt = (d: Date) => format.dateTime(d, { dateStyle: "medium", timeStyle: "short" });

  // Simple progress timeline for the client.
  const steps = [
    { done: true, label: t("portal.stepReceived"), detail: dt(r.createdAt) },
    r.status === "DECLINED"
      ? { done: true, declined: true, label: t("portal.stepDeclined"), detail: r.declineReason }
      : { done: r.status === "APPROVED", label: t("portal.stepScheduled"), detail: wo?.dueDate ? t("portal.plannedFor", { date: dt(wo.dueDate) }) : null },
    ...(r.status !== "DECLINED"
      ? [
          { done: wo?.status === "IN_PROGRESS" || wo?.status === "DONE", label: t("portal.stepInProgress"), detail: wo?.assignees.map((a) => a.user.name).join(", ") || null },
          { done: wo?.status === "DONE", label: t("portal.stepDone"), detail: wo?.completedAt ? dt(wo.completedAt) : null },
        ]
      : []),
  ];

  return (
    <>
      {r.villa ? <BackLink href={`/portal/villas/${r.villa.id}/requests`} label={t("portal.pastRequests")} /> : <BackLink href="/portal" label={t("portal.yourVillas")} />}
      <h1 className="text-xl font-semibold">{r.title}</h1>
      <p className="mb-5 mt-1 text-sm text-muted">
        R{r.number} · {r.villa?.name}
        {r.asset && ` · ${r.asset.name}`}
      </p>

      <div className="grid gap-6 md:grid-cols-[1fr_280px]">
        <div className="min-w-0 space-y-6">
          <Card className="p-5">
            {r.description && <p className="whitespace-pre-wrap text-sm">{r.description}</p>}
            {r.attachments.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-2">
                {r.attachments.map((a) => (
                  <a key={a.id} href={fileUrl(a.id)} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={fileUrl(a.id)} alt={a.filename} className="aspect-square w-full rounded-md border border-border object-cover" />
                  </a>
                ))}
              </div>
            )}
            {!r.description && r.attachments.length === 0 && <p className="text-sm text-muted">{t("requests.noDescription")}</p>}
          </Card>
          {wo?.status === "DONE" && wo.workReport && (
            <Card className="p-5">
              <h2 className="mb-2 font-medium">{t("workReport.title")}</h2>
              <p className="whitespace-pre-wrap text-sm">{wo.workReport}</p>
            </Card>
          )}
        </div>

        <Card className="p-5">
          <ol className="space-y-4">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-3 text-sm">
                {"declined" in s && s.declined ? (
                  <XCircle className="mt-0.5 size-5 shrink-0 text-gray-400" />
                ) : s.done ? (
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-green-600" />
                ) : (
                  <Circle className="mt-0.5 size-5 shrink-0 text-gray-300" />
                )}
                <span>
                  <span className={cn("block", s.done ? "font-medium" : "text-muted")}>{s.label}</span>
                  {s.detail && <span className="block text-xs text-muted">{s.detail}</span>}
                </span>
              </li>
            ))}
          </ol>
          {wo && (
            <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-sm">
              <span className="text-muted">#{wo.number}</span>
              <WorkOrderStatusBadge status={wo.status} />
            </div>
          )}
          {wo?.status === "DONE" && (
            <Link
              href={`/report/${wo.id}`}
              prefetch={false}
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand"
            >
              <FileDown className="size-4" />
              {t("portal.downloadReport")}
            </Link>
          )}
        </Card>
      </div>
    </>
  );
}
