import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { AlertTriangle } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { CategoryChip, PriorityText, SlaBadge, SystemBadge, WorkOrderStatusBadge } from "@/components/badges";
import { slaCalendar, slaStates } from "@/lib/sla";
import { getContext } from "@/lib/context";
import { fileUrl } from "@/lib/storage";
import { ACTIVE_STATUSES, workOrderCosts } from "@/lib/work-orders";
import { billedTime, timeRoundingOf } from "@/lib/billing-time";
import { urgentApplies, urgentRuleFor } from "@/lib/urgent-surcharge";
import { cn } from "@/lib/utils";
import { StatusBar } from "./status-bar";
import { Checklist } from "./checklist";
import { CommentBox, CostsPanel, Gallery, SignOff, TimeTracker, WorkOrderActions } from "./panels";
import { PartsPanel } from "./parts-panel";
import { SendReportPanel } from "./send-report";
import { reportRecipients } from "@/lib/report-email";
import { villaClient } from "@/lib/villa-client";

export default async function WorkOrderPage({ params }: PageProps<"/work-orders/[id]">) {
  const { id } = await params;
  const ctx = await getContext();
  if (!ctx.can("internal.view")) notFound();
  const t = await getTranslations();
  const format = await getFormatter();

  const wo = await ctx.db.workOrder.findUnique({
    where: { id },
    include: {
      villa: { select: { id: true, name: true, client: { select: { id: true, name: true } }, manager: { select: { id: true, name: true } }, billTo: true } },
      area: { select: { name: true } },
      asset: { select: { id: true, name: true, status: true } },
      team: { select: { name: true, color: true } },
      createdBy: { select: { name: true } },
      completedBy: { select: { name: true } },
      assignees: { select: { user: { select: { id: true, name: true } } } },
      items: { orderBy: { sortOrder: "asc" }, include: { completedBy: { select: { name: true } } } },
      comments: { include: { user: { select: { name: true } }, attachments: true }, orderBy: { createdAt: "asc" } },
      statusLogs: { include: { user: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
      timeEntries: { include: { user: { select: { name: true } } }, orderBy: { startedAt: "desc" } },
      otherCosts: true,
      parts: { include: { part: { select: { name: true, unit: true } }, stockLocation: { select: { name: true } } }, orderBy: { id: "asc" } },
      attachments: { where: { commentId: null, workOrderItemId: null }, orderBy: { createdAt: "asc" } },
      request: { select: { id: true, number: true } },
      contract: { select: { id: true, name: true, responseTimeHours: true, resolutionTimeHours: true, businessHoursOnly: true, pauseOnHold: true, urgentFee: true, urgentPercent: true } },
      categories: { select: { id: true, name: true, color: true }, orderBy: { name: "asc" } },
    },
  });
  if (!wo) notFound();

  const canExecute = ctx.can("workOrders.execute");
  const canUseParts = canExecute && ctx.can("inventory.use");
  const [meters, procedures, partOptions, locations, staff] = await Promise.all([
    wo.assetId ? ctx.db.meter.findMany({ where: { assetId: wo.assetId }, select: { id: true, name: true, unit: true }, orderBy: { name: "asc" } }) : [],
    ctx.db.procedure.findMany({ where: { archivedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    canUseParts
      ? ctx.db.part.findMany({
          where: { archivedAt: null },
          select: {
            id: true,
            name: true,
            sku: true,
            barcode: true,
            unit: true,
            stock: { where: { quantity: { gt: 0 } }, select: { locationId: true, quantity: true } },
            assets: wo.assetId ? { where: { id: wo.assetId }, select: { id: true } } : false,
          },
          orderBy: { name: "asc" },
          take: 1000,
        })
      : [],
    canUseParts
      ? ctx.db.stockLocation.findMany({ where: { archivedAt: null }, select: { id: true, name: true, type: true, userId: true }, orderBy: [{ type: "asc" }, { name: "asc" }] })
      : [],
    canExecute
      ? ctx.db.membership.findMany({ where: { active: true, role: { not: "REQUESTER" } }, select: { user: { select: { id: true, name: true } } }, orderBy: { user: { name: "asc" } } })
      : [],
  ]);
  // Parts come out of my van by default, else the first warehouse.
  const defaultLocationId =
    locations.find((l) => l.type === "VAN" && l.userId === ctx.user.id)?.id ?? locations.find((l) => l.type === "WAREHOUSE")?.id ?? null;
  const involved = wo.createdById === ctx.user.id || wo.assignees.some((a) => a.user.id === ctx.user.id);
  const canEdit = ctx.can("workOrders.manage") || (ctx.can("workOrders.create") && involved);
  const closed = wo.status === "DONE" || wo.status === "CANCELLED";
  const now = new Date();
  const overdue = !!wo.dueDate && wo.dueDate < now && ACTIVE_STATUSES.includes(wo.status);

  const money = (n: number) => format.number(n, { style: "currency", currency: ctx.organization.currency });
  const block = timeRoundingOf(ctx.organization.timeRounding);
  const urgentRule = urgentRuleFor(ctx.organization, wo.contract);
  const costs = workOrderCosts(wo, block, urgentRule);
  const dt = (d: Date) => format.dateTime(d, { dateStyle: "medium", timeStyle: "short" });
  const reportEmail = ctx.can("workOrders.sendReport") ? await reportRecipients(ctx, wo.id) : null;
  const sla = wo.contract ? slaStates(wo, wo.contract, now, slaCalendar(ctx.organization)) : null;
  const myRunning = wo.timeEntries.find((e) => e.userId === ctx.user.id && !e.endedAt);

  // Activity: comments and status changes, oldest first.
  const activity = [
    ...wo.comments.map((c) => ({ kind: "comment" as const, at: c.createdAt, c })),
    ...wo.statusLogs.map((s) => ({ kind: "status" as const, at: s.createdAt, s })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  const details: [string, React.ReactNode][] = [
    [t("assets.villa"), wo.villa && <Link href={`/villas/${wo.villa.id}`} className="hover:text-brand">{wo.villa.name}</Link>],
    [t("villas.client"), wo.villa && villaClient(wo.villa) && <Link href={`/clients/${villaClient(wo.villa)!.id}`} className="hover:text-brand">{villaClient(wo.villa)!.name}</Link>],
    [t("assets.area"), wo.area?.name],
    [t("wo.asset"), wo.asset && <Link href={`/assets/${wo.asset.id}`} className="hover:text-brand">{wo.asset.name}</Link>],
    [t("wo.type"), t(`woType.${wo.type}`)],
    [t("wo.startDate"), wo.startDate && dt(wo.startDate)],
    [
      t("wo.dueDate"),
      wo.dueDate && (
        <span className={cn(overdue && "font-medium text-danger")}>
          {dt(wo.dueDate)}
          {overdue && ` · ${t("wo.overdue")}`}
        </span>
      ),
    ],
    [t("wo.estimatedHours"), wo.estimatedMinutes != null && `${+(wo.estimatedMinutes / 60).toFixed(2)} h`],
    [t("wo.team"), wo.team && (<span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ backgroundColor: wo.team.color }} />{wo.team.name}</span>)],
    [t("categories.title"), wo.categories.length > 0 && <span className="flex flex-wrap gap-1">{wo.categories.map((c) => <CategoryChip key={c.id} name={c.name} color={c.color} />)}</span>],
    [t("wo.assignees"), wo.assignees.map((a) => a.user.name).join(", ") || <span className="text-muted">{t("wo.unassigned")}</span>],
    [t("wo.createdBy"), `${wo.createdBy.name} · ${dt(wo.createdAt)}`],
    [t("wo.completedBy"), wo.completedBy && wo.completedAt && `${wo.completedBy.name} · ${dt(wo.completedAt)}`],
    [t("wo.fromRequest"), wo.request && `#${wo.request.number}`],
    [t("contracts.contract"), wo.contract && <Link href={`/contracts/${wo.contract.id}`} className="hover:text-brand">{wo.contract.name}</Link>],
    [t("contracts.respondBy"), sla && (sla.responseDue || sla.response === "paused") && <span className="flex flex-wrap items-center gap-1.5">{sla.responseDue && dt(sla.responseDue)} <SlaBadge state={sla.response} /></span>],
    [t("contracts.resolveBy"), sla && (sla.resolutionDue || sla.resolution === "paused") && <span className="flex flex-wrap items-center gap-1.5">{sla.resolutionDue && dt(sla.resolutionDue)} <SlaBadge state={sla.resolution} /></span>],
  ];

  return (
    <>
      <BackLink href="/work-orders" label={t("nav.workOrders")} />
      <PageHeader
        title={`#${wo.number} · ${wo.title}`}
        actions={<WorkOrderActions woId={wo.id} canEdit={canEdit} canDelete={ctx.can("workOrders.manage")} />}
      />
      <div className="-mt-3 mb-5 flex flex-wrap items-center gap-2">
        <WorkOrderStatusBadge status={wo.status} />
        {wo.system && <SystemBadge system={wo.system} />}
        <PriorityText priority={wo.priority} />
        {overdue && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-danger">
            <AlertTriangle className="size-3.5" />
            {t("wo.overdue")}
          </span>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          <Card className="p-4">
            <StatusBar id={wo.id} status={wo.status} canExecute={canExecute} />
          </Card>

          {wo.description && (
            <Card className="p-5">
              <p className="whitespace-pre-wrap text-sm">{wo.description}</p>
            </Card>
          )}

          <Card>
            <Checklist
              woId={wo.id}
              locked={closed || !canExecute}
              canEdit={canEdit && !closed}
              meters={meters}
              procedures={procedures}
              items={wo.items.map((i) => ({
                id: i.id,
                type: i.type,
                label: i.label,
                description: i.description,
                required: i.required,
                options: i.options,
                unit: i.unit,
                value: i.value,
                note: i.note,
                completedBy: i.completedBy?.name ?? null,
              }))}
            />
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 font-medium">{t("activity.title")}</h2>
            <ol className="mb-5 space-y-4">
              {activity.map((a) =>
                a.kind === "status" ? (
                  <li key={`s-${a.s.id}`} className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span className="font-medium text-foreground">{a.s.user.name}</span>
                    {a.s.fromStatus ? t("activity.changedStatus") : t("activity.created")}
                    <WorkOrderStatusBadge status={a.s.toStatus} />
                    <span>{dt(a.at)}</span>
                    {a.s.note && <span className="w-full pl-0 italic">“{a.s.note}”</span>}
                  </li>
                ) : (
                  <li key={`c-${a.c.id}`} className="text-sm">
                    <div className="mb-1 flex items-baseline gap-2">
                      <span className="font-medium">{a.c.user.name}</span>
                      <span className="text-xs text-muted">{dt(a.at)}</span>
                    </div>
                    {a.c.body && <p className="whitespace-pre-wrap rounded-md bg-gray-50 px-3 py-2">{a.c.body}</p>}
                    {a.c.attachments.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {a.c.attachments.map((f) => (
                          <a key={f.id} href={fileUrl(f.id)} target="_blank" rel="noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={fileUrl(f.id)} alt={f.filename} className="size-20 rounded-md border border-border object-cover" />
                          </a>
                        ))}
                      </div>
                    )}
                  </li>
                ),
              )}
            </ol>
            {canExecute && <CommentBox woId={wo.id} members={staff.map((m) => m.user).filter((u) => u.id !== ctx.user.id)} />}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <dl className="space-y-2.5 text-sm">
              {details
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[110px_1fr] gap-2">
                    <dt className="text-muted">{k}</dt>
                    <dd className="min-w-0 break-words">{v}</dd>
                  </div>
                ))}
            </dl>
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 font-medium">{t("time.title")}</h2>
            <TimeTracker
              woId={wo.id}
              canExecute={canExecute && !closed}
              canDeleteAny={ctx.can("workOrders.manage")}
              runningSince={myRunning?.startedAt.toISOString() ?? null}
              entries={wo.timeEntries.map((e) => ({
                id: e.id,
                user: e.user.name,
                mine: e.userId === ctx.user.id,
                minutes: e.minutes,
                startedAt: e.startedAt.toISOString(),
                label: format.dateTime(e.startedAt, { dateStyle: "short" }),
                note: e.note,
              }))}
              billed={
                block
                  ? {
                      block,
                      total: costs.billedMinutes,
                      people: billedTime(wo.timeEntries, block).people.map((p) => ({
                        name: wo.timeEntries.find((e) => e.userId === p.userId)?.user.name ?? "",
                        minutes: p.minutes,
                        billed: p.billed,
                      })),
                    }
                  : null
              }
            />
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 font-medium">{t("files.title")}</h2>
            <Gallery
              woId={wo.id}
              canExecute={canExecute}
              canDeleteAny={ctx.can("workOrders.manage")}
              files={wo.attachments
                .filter((f) => f.id !== wo.signatureUrl)
                .map((f) => ({ id: f.id, url: fileUrl(f.id), filename: f.filename, mimeType: f.mimeType, mine: f.uploadedById === ctx.user.id }))}
            />
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 font-medium">{t("woParts.title")}</h2>
            <PartsPanel
              woId={wo.id}
              canUse={canUseParts}
              used={wo.parts.map((p) => ({
                id: p.id,
                partId: p.partId,
                name: p.part.name,
                qty: `${format.number(Number(p.quantity))} ${p.part.unit}`,
                location: p.stockLocation?.name ?? null,
                cost: money(Number(p.quantity) * Number(p.unitCost)),
                serials: p.serialNumbers,
              }))}
              options={partOptions.map((p) => ({
                id: p.id,
                name: p.name,
                sku: p.sku,
                barcode: p.barcode,
                unit: p.unit,
                compatible: Array.isArray(p.assets) && p.assets.length > 0,
                stock: Object.fromEntries(p.stock.map((s) => [s.locationId, Number(s.quantity)])),
              }))}
              locations={locations.map((l) => ({ id: l.id, name: l.name }))}
              defaultLocationId={defaultLocationId}
              orderHref={ctx.can("purchasing.manage") && !closed ? `/purchase-orders/new?workOrderId=${wo.id}` : null}
            />
          </Card>

          {ctx.can("costs.view") && (
          <Card className="p-5">
            <h2 className="mb-3 font-medium">{t("costs.title")}</h2>
            <CostsPanel
              woId={wo.id}
              canExecute={canExecute}
              costs={wo.otherCosts.map((c) => ({ id: c.id, description: c.description, amount: money(Number(c.amount)) }))}
              summary={{
                labor: money(costs.labor),
                parts: costs.parts ? money(costs.parts) : null,
                other: money(costs.other),
                total: money(costs.total),
                urgent: urgentApplies(wo.priority, urgentRule)
                  ? { amount: money(costs.urgent), rule: [urgentRule.fee ? money(urgentRule.fee) : null, urgentRule.percent ? `${urgentRule.percent}%` : null].filter(Boolean).join(" + ") }
                  : null,
              }}
            />
          </Card>
          )}

          <Card className="p-5">
            <h2 className="mb-3 font-medium">{t("signoff.title")}</h2>
            <SignOff
              woId={wo.id}
              canExecute={canExecute}
              clientAbsent={wo.clientAbsent}
              done={wo.status === "DONE"}
              signed={
                wo.signatureUrl && wo.signedByName && wo.signedAt
                  ? { name: wo.signedByName, at: dt(wo.signedAt), url: fileUrl(wo.signatureUrl) }
                  : null
              }
            />
          </Card>

          {reportEmail && (
            <Card className="p-5">
              <h2 className="mb-1 font-medium">{t("reportEmail.title")}</h2>
              <p className="mb-3 text-xs text-muted">{t("reportEmail.hint")}</p>
              <SendReportPanel
                woId={wo.id}
                recipients={reportEmail.recipients}
                lastSent={reportEmail.wo.reportSentAt ? { at: dt(reportEmail.wo.reportSentAt), count: reportEmail.wo.reportSentTo.length } : null}
              />
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
