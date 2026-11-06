import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { AlertTriangle } from "lucide-react";
import { Card, PageHeader, Textarea } from "@/components/ui";
import { ActionForm, FieldError } from "@/components/action-form";
import { saveWorkReportAction } from "../actions";
import { WORK_REPORT_MAX } from "@/lib/wo-ops";
import { BackLink } from "@/components/back-link";
import { CategoryChip, PriorityText, SlaBadge, SystemBadge, WorkOrderStatusBadge } from "@/components/badges";
import { slaCalendar, slaStates } from "@/lib/sla";
import { getContext } from "@/lib/context";
import { fileUrl } from "@/lib/storage";
import { ACTIVE_STATUSES, jobTechnicians, workOrderCosts } from "@/lib/work-orders";
import { canLogTime, withoutTime } from "@/lib/wo-time";
import { billedTime, timeRoundingOf } from "@/lib/billing-time";
import { urgentApplies, urgentRuleFor } from "@/lib/urgent-surcharge";
import { countTrips, isFar, travelOf } from "@/lib/travel-charge";
import { cn } from "@/lib/utils";
import { StatusBar } from "./status-bar";
import { Checklist } from "./checklist";
import { CommentBox, CostsPanel, Gallery, SignOff, TimeTracker, WorkOrderActions } from "./panels";
import { PartsPanel } from "./parts-panel";
import { BillingPanel } from "./billing-panel";
import { RelatedPanel } from "./related-panel";
import { Assignees } from "./assignees";
import { AttachmentThumb } from "@/components/attachment-thumb";
import { SendReportPanel } from "./send-report";
import { reportRecipients } from "@/lib/report-email";
import { villaClient } from "@/lib/villa-client";
import { roleName, WORK_ORDER_BUILT_IN_ROLE } from "@/lib/roles";
import { openRequestChat } from "@/lib/request-chat";
import { RequestChat } from "@/components/request-chat";
import { docRef } from "@/lib/series";

const RELATED = { id: true, year: true, number: true, title: true, status: true } as const;

export default async function WorkOrderPage({ params }: PageProps<"/work-orders/[id]">) {
  const { id } = await params;
  const ctx = await getContext();
  if (!ctx.can("internal.view")) notFound();
  const t = await getTranslations();
  const format = await getFormatter();

  const wo = await ctx.db.workOrder.findUnique({
    where: { id },
    include: {
      villa: { select: { id: true, name: true, distanceKm: true, client: { select: { id: true, name: true } }, manager: { select: { id: true, name: true } }, billTo: true } },
      area: { select: { name: true } },
      asset: { select: { id: true, name: true, status: true } },
      team: { select: { name: true, color: true } },
      createdBy: { select: { name: true } },
      completedBy: { select: { name: true } },
      invoicedBy: { select: { name: true } },
      linksFrom: { select: { id: true, to: { select: RELATED } } },
      linksTo: { select: { id: true, from: { select: RELATED } } },
      assignees: {
        select: {
          role: true,
          jobRole: { select: { id: true, name: true } },
          user: { select: { id: true, name: true, memberships: { where: { organizationId: ctx.organization.id }, select: { role: true, jobRole: { select: { id: true, name: true } } } } } },
        },
      },
      items: { orderBy: { sortOrder: "asc" }, include: { completedBy: { select: { name: true } } } },
      comments: { include: { user: { select: { name: true } }, attachments: true }, orderBy: { createdAt: "asc" } },
      statusLogs: { include: { user: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
      timeEntries: { include: { user: { select: { name: true } } }, orderBy: { startedAt: "desc" } },
      otherCosts: true,
      parts: { include: { part: { select: { name: true, unit: true } }, stockLocation: { select: { name: true } } }, orderBy: { id: "asc" } },
      attachments: { where: { commentId: null, workOrderItemId: null }, orderBy: { createdAt: "asc" } },
      request: { select: { id: true, year: true, number: true, availableFrom: true, availableTo: true, scheduledFor: true } },
      contract: { select: { id: true, name: true, responseTimeHours: true, resolutionTimeHours: true, businessHoursOnly: true, pauseOnHold: true, urgentFee: true, urgentPercent: true, travelIncluded: true, travelFee: true, travelKmRate: true } },
      categories: { select: { id: true, name: true, color: true }, orderBy: { name: "asc" } },
    },
  });
  if (!wo) notFound();

  const canExecute = ctx.can("workOrders.execute");
  const canUseParts = canExecute && ctx.can("inventory.use");
  const canSeeBilling = ctx.can("billing.view") || ctx.can("billing.manage");
  // Recent jobs at the same villa, offered when linking: a recurring problem is usually there.
  const linkSuggestions =
    canExecute && wo.villaId
      ? await ctx.db.workOrder.findMany({ where: { villaId: wo.villaId, id: { not: wo.id } }, select: { year: true, number: true, title: true }, orderBy: { createdAt: "desc" }, take: 50 })
      : [];
  const [meters, procedures, partOptions, locations, staff, jobRoles] = await Promise.all([
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
    canExecute && wo.status !== "DONE" && wo.status !== "CANCELLED" ? ctx.db.jobRole.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }) : [],
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
  const travel = travelOf(ctx.organization, wo.contract);
  const costs = workOrderCosts(wo, block, urgentRule, travel);
  // Trips the contract includes: shown on the job at no charge.
  const includedTrips = travel.rule.included ? countTrips(wo.timeEntries, travel.timeZone, travel.rule.perTechnician) : 0;
  const dt = (d: Date) => format.dateTime(d, { dateStyle: "medium", timeStyle: "short" });
  const reportEmail = ctx.can("workOrders.sendReport") ? await reportRecipients(ctx, wo.id) : null;
  const sla = wo.contract ? slaStates(wo, wo.contract, now, slaCalendar(ctx.organization)) : null;
  // The conversation with the client on the request this job came from (participants only).
  const chat = wo.request ? await openRequestChat(ctx, { requestId: wo.request.id }) : null;
  const canLog = canExecute && !closed && canLogTime(ctx.role, wo.assignees.some((a) => a.user.id === ctx.user.id));
  // Who still has to log time before the job can be marked done.
  const timeMissing = closed ? [] : withoutTime(await jobTechnicians(ctx, wo.assignees.map((a) => a.user.id)), wo.timeEntries).map((p) => p.name);
  const myRunning = wo.timeEntries.find((e) => e.userId === ctx.user.id && !e.endedAt);
  // A new entry starts where my last one was (on site / remote); entries are newest first.
  const myLastMode = wo.timeEntries.find((e) => e.userId === ctx.user.id)?.mode ?? "ONSITE";

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
    [
      t("wo.assignees"),
      <Assignees
        key="assignees"
        woId={wo.id}
        options={[{ value: WORK_ORDER_BUILT_IN_ROLE, label: t(`roles.${WORK_ORDER_BUILT_IN_ROLE}`) }, ...jobRoles.map((r) => ({ value: r.id, label: r.name }))]}
        assignees={wo.assignees.map((a) => {
          const own = a.user.memberships[0];
          const ownName = own ? roleName(own, (r) => t(`roles.${r}`)) : "";
          // The role taken on this job, else the person's own (shown as such when it can't be taken on a job).
          const ownValue = own?.jobRole?.id ?? (own?.role === WORK_ORDER_BUILT_IN_ROLE ? WORK_ORDER_BUILT_IN_ROLE : "");
          return {
            id: a.user.id,
            name: a.user.name,
            value: a.jobRole?.id ?? a.role ?? ownValue,
            label: a.jobRole?.name ?? (a.role ? t(`roles.${a.role}`) : ownName),
            ownName,
            // Each assignee picks their own role on the job; managers set anyone's.
            editable: canExecute && !closed && (a.user.id === ctx.user.id || ctx.can("workOrders.manage")),
          };
        })}
      />,
    ],
    [t("wo.createdBy"), `${wo.createdBy.name} · ${dt(wo.createdAt)}`],
    [t("wo.completedBy"), wo.completedBy && wo.completedAt && `${wo.completedBy.name} · ${dt(wo.completedAt)}`],
    [t("wo.fromRequest"), wo.request && <Link href={`/requests/${wo.request.id}`} className="hover:text-brand">{docRef(wo.request)}</Link>],
    [t("requests.windowLabel"), wo.request?.availableFrom && wo.request.availableTo && format.dateTimeRange(wo.request.availableFrom, wo.request.availableTo, { dateStyle: "medium", timeStyle: "short" })],
    [t("requests.visitLabel"), wo.request?.scheduledFor && <Link href={`/requests/${wo.request.id}`} className="font-medium hover:text-brand">{dt(wo.request.scheduledFor)}</Link>],
    [t("contracts.contract"), wo.contract && <Link href={`/contracts/${wo.contract.id}`} className="hover:text-brand">{wo.contract.name}</Link>],
    [t("contracts.respondBy"), sla && (sla.responseDue || sla.response === "paused") && <span className="flex flex-wrap items-center gap-1.5">{sla.responseDue && dt(sla.responseDue)} <SlaBadge state={sla.response} /></span>],
    [t("contracts.resolveBy"), sla && (sla.resolutionDue || sla.resolution === "paused") && <span className="flex flex-wrap items-center gap-1.5">{sla.resolutionDue && dt(sla.resolutionDue)} <SlaBadge state={sla.resolution} /></span>],
  ];

  return (
    <>
      <BackLink href="/work-orders" label={t("nav.workOrders")} />
      <PageHeader
        title={`${docRef(wo)} · ${wo.title}`}
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
            <h2 className="mb-1 font-medium">
              <label htmlFor="workReport">{t("workReport.title")}</label>
            </h2>
            {canExecute && !closed ? (
              <ActionForm action={saveWorkReportAction.bind(null, wo.id)} successMessage={t("common.saved")}>
                <p className="text-sm text-muted">{t("workReport.hint")}</p>
                <Textarea id="workReport" name="workReport" defaultValue={wo.workReport ?? ""} maxLength={WORK_REPORT_MAX} rows={5} placeholder={t("workReport.placeholder")} />
                <FieldError name="workReport" />
              </ActionForm>
            ) : (
              <p className="whitespace-pre-wrap text-sm">{wo.workReport || <span className="text-muted">{t("workReport.empty")}</span>}</p>
            )}
            <RelatedPanel
              woId={wo.id}
              canEdit={canExecute}
              suggestions={linkSuggestions.map((w) => ({ ref: docRef(w), title: w.title }))}
              links={[...wo.linksFrom.map((l) => ({ id: l.id, wo: l.to })), ...wo.linksTo.map((l) => ({ id: l.id, wo: l.from }))]
                .sort((a, b) => b.wo.year - a.wo.year || b.wo.number - a.wo.number)
                .map((l) => ({ id: l.id, woId: l.wo.id, ref: docRef(l.wo), title: l.wo.title, status: l.wo.status }))}
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
                            <AttachmentThumb url={fileUrl(f.id)} filename={f.filename} mimeType={f.mimeType} className="size-20" />
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

          {chat && (
            <Card className="p-5">
              <RequestChat initial={chat} />
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {canSeeBilling && (
            <Card className="p-5">
              <h2 className="mb-3 font-medium">{t("billing.title")}</h2>
              <BillingPanel
                key={wo.invoiceNumber ?? ""}
                woId={wo.id}
                canManage={ctx.can("billing.manage")}
                invoiced={wo.invoicedAt ? { number: wo.invoiceNumber, at: dt(wo.invoicedAt), by: wo.invoicedBy?.name ?? null } : null}
              />
            </Card>
          )}
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
              canLog={canLog}
              missing={timeMissing}
              unrated={ctx.can("costs.view") && wo.timeEntries.some((e) => (e.minutes ?? 0) > 0 && e.hourlyRate === null)}
              canDeleteAny={ctx.can("workOrders.manage")}
              runningSince={myRunning?.startedAt.toISOString() ?? null}
              runningMode={myRunning?.mode ?? null}
              defaultMode={myLastMode}
              entries={wo.timeEntries.map((e) => ({
                id: e.id,
                user: e.user.name,
                mine: e.userId === ctx.user.id,
                minutes: e.minutes,
                startedAt: e.startedAt.toISOString(),
                mode: e.mode,
                label: format.dateTime(e.startedAt, { dateStyle: "short" }),
                note: e.note,
              }))}
              billed={
                block
                  ? {
                      block,
                      total: costs.billedMinutes,
                      people: billedTime(wo.timeEntries, block, ctx.organization.timezone).people.map((p) => ({
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
              showCost={ctx.can("costs.view")}
              used={wo.parts.map((p) => ({
                id: p.id,
                partId: p.partId,
                name: p.part?.name ?? [p.model, p.description].filter(Boolean).join(" · "),
                qty: `${format.number(Number(p.quantity))}${p.part ? ` ${p.part.unit}` : ""}`,
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
                travel:
                  costs.trips > 0
                    ? {
                        amount: money(costs.travel),
                        trips: costs.trips,
                        rule: isFar(wo.villa?.distanceKm, travel.rule)
                          ? t("travel.perKmRule", { km: format.number(wo.villa!.distanceKm!, { maximumFractionDigits: 1 }), rate: money(travel.rule.kmRate) })
                          : t("travel.perTripRule", { amount: money(costs.perTrip) }),
                      }
                    : includedTrips > 0
                      ? { amount: money(0), trips: includedTrips, rule: t("travel.includedInContract") }
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
