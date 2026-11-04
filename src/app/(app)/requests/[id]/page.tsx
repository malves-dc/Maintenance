import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { CalendarCheck, CalendarClock, Mail, Phone, PhoneCall } from "lucide-react";
import { Card, PageHeader, Textarea } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { ActionForm } from "@/components/action-form";
import { PriorityText, SystemBadge, WorkOrderStatusBadge } from "@/components/badges";
import { RequestStatusBadge } from "@/components/request-badge";
import { getContext } from "@/lib/context";
import { fileUrl } from "@/lib/storage";
import { assignableUsers, workOrderCosts } from "@/lib/work-orders";
import { timeRoundingOf } from "@/lib/billing-time";
import { urgentRuleFor } from "@/lib/urgent-surcharge";
import { travelOf } from "@/lib/travel-charge";
import { approveRequestAction, declineRequestAction, scheduleRequestAction } from "../actions";
import { DateTimeField } from "@/components/datetime-field";
import { FieldError } from "@/components/action-form";
import { canReschedule, slotInWindow } from "@/lib/request-window";
import { ApproveFields } from "./approve-fields";
import { villaClient } from "@/lib/villa-client";

export default async function RequestPage({ params }: PageProps<"/requests/[id]">) {
  const { id } = await params;
  const ctx = await getContext();
  if (!ctx.can("internal.view")) notFound();
  const t = await getTranslations();
  const format = await getFormatter();

  const r = await ctx.db.request.findUnique({
    where: { id },
    include: {
      villa: { select: { id: true, name: true, client: { select: { id: true, name: true } }, manager: { select: { id: true, name: true } }, billTo: true } },
      area: { select: { name: true } },
      asset: { select: { id: true, name: true, status: true } },
      requester: { select: { name: true, email: true, phone: true } },
      onCallUsers: { select: { id: true, name: true }, orderBy: { name: "asc" } },
      workOrder: {
        select: {
          id: true,
          number: true,
          status: true,
          priority: true,
          contract: { select: { urgentFee: true, urgentPercent: true, travelIncluded: true, travelFee: true, travelKmRate: true } },
          villa: { select: { distanceKm: true } },
          timeEntries: { select: { userId: true, minutes: true, hourlyRate: true, startedAt: true, mode: true } },
          otherCosts: { select: { amount: true } },
          parts: { select: { quantity: true, unitCost: true } },
        },
      },
      attachments: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!r) notFound();
  // Approvers, and whoever was on call when it arrived.
  const isHandler = ctx.can("requests.approve") || r.onCallUsers.some((u) => u.id === ctx.user.id);
  const canApprove = isHandler && r.status === "PENDING";
  const canSchedule = isHandler && r.status === "APPROVED" && canReschedule(r.status, r.workOrder?.status);
  const dt = (d: Date) => format.dateTime(d, { dateStyle: "medium", timeStyle: "short" });
  const clientWindow = r.availableFrom && r.availableTo ? format.dateTimeRange(r.availableFrom, r.availableTo, { dateStyle: "medium", timeStyle: "short" }) : null;
  const outsideWindow = !!r.scheduledFor && !slotInWindow(r.scheduledFor, r);

  const [teams, members] = canApprove
    ? await Promise.all([
        ctx.db.team.findMany({ include: { members: { select: { userId: true } } }, orderBy: { name: "asc" } }),
        assignableUsers(ctx.db),
      ])
    : [[], []];

  const name = r.requester?.name ?? r.requesterName;
  const email = r.requester?.email ?? r.requesterEmail;
  const phone = r.requester?.phone ?? r.requesterPhone;

  return (
    <>
      <BackLink href="/requests" label={t("nav.requests")} />
      <PageHeader title={`R${r.number} · ${r.title}`} />
      <div className="-mt-3 mb-5 flex flex-wrap items-center gap-2">
        <RequestStatusBadge status={r.status} />
        {r.system && <SystemBadge system={r.system} />}
        <PriorityText priority={r.priority} />
        <span className="text-xs text-muted">{format.dateTime(r.createdAt, { dateStyle: "medium", timeStyle: "short" })}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card className="p-5">
            {r.description ? <p className="whitespace-pre-wrap text-sm">{r.description}</p> : <p className="text-sm text-muted">{t("requests.noDescription")}</p>}
            {r.attachments.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {r.attachments.map((a) => (
                  <a key={a.id} href={fileUrl(a.id)} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={fileUrl(a.id)} alt={a.filename} className="aspect-square w-full rounded-md border border-border object-cover" />
                  </a>
                ))}
              </div>
            )}
          </Card>

          {r.status === "APPROVED" && r.workOrder && (
            <Card className="flex items-center justify-between gap-3 p-5 text-sm">
              <span>{t("requests.approvedAs")}</span>
              <Link href={`/work-orders/${r.workOrder.id}`} className="flex items-center gap-2 font-medium hover:text-brand">
                #{r.workOrder.number}
                <WorkOrderStatusBadge status={r.workOrder.status} />
              </Link>
            </Card>
          )}
          {canSchedule && (
            <Card className="p-5">
              <h2 className="mb-1 font-medium">{r.scheduledFor ? t("requests.visitTitle") : t("requests.confirmVisitTitle")}</h2>
              <p className="mb-4 text-sm text-muted">{clientWindow ? t("requests.clientWindow", { window: clientWindow }) : t("requests.confirmVisitHint")}</p>
              <ActionForm
                action={scheduleRequestAction.bind(null, r.id)}
                submitLabel={r.scheduledFor ? t("requests.moveVisit") : t("requests.confirmVisitButton")}
                successMessage={t("requests.visitSaved")}
              >
                <DateTimeField name="scheduledFor" defaultValue={r.scheduledFor?.toISOString()} />
                <FieldError name="scheduledFor" />
              </ActionForm>
            </Card>
          )}
          {r.status === "APPROVED" && r.workOrder && ctx.can("costs.view") && (() => {
            // What this request has cost so far: time (at each person's role rate), parts and other costs.
            const c = workOrderCosts(r.workOrder, timeRoundingOf(ctx.organization.timeRounding), urgentRuleFor(ctx.organization, r.workOrder.contract), travelOf(ctx.organization, r.workOrder.contract));
            const money = (n: number) => format.number(n, { style: "currency", currency: ctx.organization.currency });
            return (
              <Card className="p-5 text-sm">
                <h2 className="mb-3 font-medium">{t("costs.title")}</h2>
                <dl className="grid grid-cols-[1fr_auto] gap-y-1.5">
                  <dt className="text-muted">{t("costs.timeSpent")}</dt>
                  <dd className="text-right tabular-nums">{t("costs.hours", { hours: Math.round((c.minutes / 60) * 100) / 100 })}</dd>
                  {c.billedMinutes !== c.minutes && (
                    <>
                      <dt className="text-muted">{t("costs.timeBilled")}</dt>
                      <dd className="text-right tabular-nums">{t("costs.hours", { hours: Math.round((c.billedMinutes / 60) * 100) / 100 })}</dd>
                    </>
                  )}
                  <dt className="text-muted">{t("costs.labor")}</dt>
                  <dd className="text-right tabular-nums">{money(c.labor)}</dd>
                  {c.parts > 0 && (
                    <>
                      <dt className="text-muted">{t("costs.parts")}</dt>
                      <dd className="text-right tabular-nums">{money(c.parts)}</dd>
                    </>
                  )}
                  {c.other > 0 && (
                    <>
                      <dt className="text-muted">{t("costs.other")}</dt>
                      <dd className="text-right tabular-nums">{money(c.other)}</dd>
                    </>
                  )}
                  {c.urgent > 0 && (
                    <>
                      <dt className="text-muted">{t("costs.urgent")}</dt>
                      <dd className="text-right tabular-nums">{money(c.urgent)}</dd>
                    </>
                  )}
                  {c.travel > 0 && (
                    <>
                      <dt className="text-muted">{t("costs.trips", { count: c.trips })}</dt>
                      <dd className="text-right tabular-nums">{money(c.travel)}</dd>
                    </>
                  )}
                  <dt className="border-t border-border pt-1.5 font-medium">{t("costs.total")}</dt>
                  <dd className="border-t border-border pt-1.5 text-right font-medium tabular-nums">{money(c.total)}</dd>
                </dl>
              </Card>
            );
          })()}
          {r.status === "DECLINED" && (
            <Card className="p-5 text-sm">
              <div className="font-medium">{t("requests.declined")}</div>
              {r.declineReason && <p className="mt-1 text-muted">{r.declineReason}</p>}
            </Card>
          )}

          {canApprove && (
            <Card className="p-5">
              <h2 className="mb-4 font-medium">{t("requests.approveTitle")}</h2>
              <ActionForm action={approveRequestAction.bind(null, r.id)} submitLabel={t("requests.approve")}>
                <ApproveFields
                  title={r.title}
                  priority={r.priority}
                  system={r.system}
                  teams={teams.map((x) => ({ id: x.id, name: x.name, memberIds: x.members.map((m) => m.userId) }))}
                  people={members}
                  initialAssignees={r.onCallUsers.map((u) => u.id).filter((id) => members.some((m) => m.id === id))}
                  clientWindow={clientWindow}
                />
              </ActionForm>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="space-y-3 p-5 text-sm">
            <div>
              <div className="text-xs text-muted">{t("requests.from")}</div>
              <div className="font-medium">{name ?? "—"}</div>
              {!r.requesterId && <div className="text-xs text-muted">{t("requests.viaQr")}</div>}
              {phone && (
                <a href={`tel:${phone}`} className="mt-1 flex items-center gap-1.5 text-brand">
                  <Phone className="size-3.5" />
                  {phone}
                </a>
              )}
              {email && (
                <a href={`mailto:${email}`} className="flex items-center gap-1.5 text-brand">
                  <Mail className="size-3.5" />
                  {email}
                </a>
              )}
            </div>
            {clientWindow && (
              <div>
                <div className="text-xs text-muted">{t("requests.windowLabel")}</div>
                <div className="flex items-center gap-1.5">
                  <CalendarClock className="size-3.5 text-muted" />
                  {clientWindow}
                </div>
              </div>
            )}
            {r.scheduledFor && (
              <div>
                <div className="text-xs text-muted">{t("requests.visitLabel")}</div>
                <div className="flex items-center gap-1.5 font-medium">
                  <CalendarCheck className="size-3.5 text-green-600" />
                  {dt(r.scheduledFor)}
                </div>
                {outsideWindow && <div className="text-xs text-amber-700">{t("requests.outsideWindow")}</div>}
              </div>
            )}
            {r.onCallUsers.length > 0 && (
              <div>
                <div className="text-xs text-muted">{t("onCall.requestOnCall")}</div>
                {r.onCallUsers.map((u) => (
                  <div key={u.id} className="flex items-center gap-1.5">
                    <PhoneCall className="size-3.5 text-muted" />
                    {u.name}
                  </div>
                ))}
              </div>
            )}
            {r.villa && (
              <div>
                <div className="text-xs text-muted">{t("assets.villa")}</div>
                <Link href={`/villas/${r.villa.id}`} className="hover:text-brand">
                  {r.villa.name}
                </Link>
                <div className="text-xs text-muted">{villaClient(r.villa)?.name}</div>
              </div>
            )}
            {r.area && (
              <div>
                <div className="text-xs text-muted">{t("assets.area")}</div>
                {r.area.name}
              </div>
            )}
            {r.asset && (
              <div>
                <div className="text-xs text-muted">{t("wo.asset")}</div>
                <Link href={`/assets/${r.asset.id}`} className="hover:text-brand">
                  {r.asset.name}
                </Link>
              </div>
            )}
          </Card>

          {canApprove && (
            <Card className="p-5">
              <h2 className="mb-3 font-medium">{t("requests.declineTitle")}</h2>
              <ActionForm action={declineRequestAction.bind(null, r.id)} submitLabel={t("requests.decline")}>
                <Textarea name="reason" placeholder={t("requests.declinePlaceholder")} className="min-h-16" />
              </ActionForm>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
