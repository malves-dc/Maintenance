import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Pencil, Trash2 } from "lucide-react";
import { Button, Card, PageHeader, Table } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { ConfirmIconButton } from "@/components/confirm-button";
import { SlaBadge, SystemBadge, WorkOrderStatusBadge } from "@/components/badges";
import { getContext } from "@/lib/context";
import { compliance, contractYear, SLA_STATUS_LOGS, slaCalendar, slaStates } from "@/lib/sla";
import { cn } from "@/lib/utils";
import { urgentRuleFor, type UrgentRule } from "@/lib/urgent-surcharge";
import { deleteContractAction } from "../actions";
import { ContractStatusBadge } from "../status-badge";
import { docRef } from "@/lib/series";

const WINDOW_DAYS = 90;

export default async function ContractPage({ params }: PageProps<"/contracts/[id]">) {
  const { id } = await params;
  const ctx = await getContext();
  if (!ctx.can("internal.view")) notFound();
  const t = await getTranslations();
  const format = await getFormatter();

  const contract = await ctx.db.serviceContract.findUnique({
    where: { id },
    include: { client: { select: { id: true, name: true } }, villa: { select: { id: true, name: true } } },
  });
  if (!contract) notFound();

  const now = new Date();
  const since = new Date(now.getTime() - WINDOW_DAYS * 86_400_000);
  const year = contractYear(contract.startDate, now);
  const [recent, visits, linkedTotal] = await Promise.all([
    ctx.db.workOrder.findMany({
      where: { contractId: id },
      select: { id: true, year: true, number: true, title: true, status: true, system: true, createdAt: true, firstResponseAt: true, completedAt: true, villa: { select: { name: true } }, statusLogs: SLA_STATUS_LOGS },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    ctx.db.workOrder.count({ where: { contractId: id, type: { in: ["PREVENTIVE", "INSPECTION"] }, status: "DONE", completedAt: { gte: year.from, lt: year.to } } }),
    ctx.db.workOrder.count({ where: { contractId: id } }),
  ]);

  const calendar = slaCalendar(ctx.organization);
  const judged = recent.map((w) => ({ w, s: slaStates(w, contract, now, calendar) }));
  const inWindow = judged.filter((x) => x.w.createdAt >= since);
  const response = compliance(inWindow.map((x) => x.s.response));
  const resolution = compliance(inWindow.map((x) => x.s.resolution));
  const pct = (p: number | null) => (p === null ? "—" : format.number(p, { style: "percent" }));
  const date = (d: Date) => format.dateTime(d, { dateStyle: "medium", timeZone: "UTC" });
  /** "50 € + 20%" for urgent work orders; marked as the company's when the contract doesn't set its own. */
  const urgentText = (rule: UrgentRule, own: boolean) => {
    const value =
      [rule.fee ? format.number(rule.fee, { style: "currency", currency: ctx.organization.currency }) : null, rule.percent ? `${rule.percent}%` : null].filter(Boolean).join(" + ") ||
      t("urgent.none");
    return own ? value : t("urgent.fromCompany", { value });
  };
  /** "Included", or "30 € per trip · 0.40 € per km", each marked as the company's when the contract doesn't set it. */
  const travelText = () => {
    if (contract.travelIncluded) return t("travel.included");
    const cur = (n: unknown) => format.number(Number(n), { style: "currency", currency: ctx.organization.currency });
    const fee = t("travel.feeTerm", { amount: cur(contract.travelFee ?? ctx.organization.travelFee) });
    const km = t("travel.kmTerm", { amount: cur(contract.travelKmRate ?? ctx.organization.travelKmRate) });
    return [contract.travelFee != null ? fee : t("urgent.fromCompany", { value: fee }), contract.travelKmRate != null ? km : t("urgent.fromCompany", { value: km })].join(" · ");
  };
  const dt = (d: Date) => format.dateTime(d, { dateStyle: "short", timeStyle: "short" });
  const canManage = ctx.can("contracts.manage");

  const terms: [string, React.ReactNode][] = [
    [t("villas.client"), <Link key="c" href={`/clients/${contract.client.id}`} className="hover:text-brand">{contract.client.name}</Link>],
    [t("assets.villa"), contract.villa ? <Link key="v" href={`/villas/${contract.villa.id}`} className="hover:text-brand">{contract.villa.name}</Link> : t("contracts.allVillas")],
    [t("contracts.period"), `${date(contract.startDate)} – ${contract.endDate ? date(contract.endDate) : t("contracts.openEnded")}`],
    [t("contracts.responseHours"), contract.responseTimeHours != null ? t("contracts.hours", { n: contract.responseTimeHours }) : "—"],
    [t("contracts.resolutionHours"), contract.resolutionTimeHours != null ? t("contracts.hours", { n: contract.resolutionTimeHours }) : "—"],
    [t("contracts.slaClock"), [contract.businessHoursOnly ? t("contracts.clockBusiness") : t("contracts.clockAlways"), contract.pauseOnHold && t("contracts.clockPauses")].filter(Boolean).join(" · ")],
    [t("contracts.includedVisits"), contract.includedVisits ?? "—"],
    ...(ctx.can("costs.view")
      ? ([
          [t("contracts.monthlyFee"), contract.monthlyFee != null ? format.number(Number(contract.monthlyFee), { style: "currency", currency: ctx.organization.currency }) : "—"],
          [t("urgent.contractTitle"), urgentText(urgentRuleFor(ctx.organization, contract), contract.urgentFee != null || contract.urgentPercent != null)],
          [t("travel.contractTitle"), travelText()],
        ] as [string, React.ReactNode][])
      : []),
    [
      t("contracts.systems"),
      contract.systems.length ? (
        <span key="s" className="flex flex-wrap gap-1">
          {contract.systems.map((s) => (
            <SystemBadge key={s} system={s} />
          ))}
        </span>
      ) : (
        t("contracts.allSystems")
      ),
    ],
  ];

  const tiles = [
    { label: t("contracts.responseCompliance", { days: WINDOW_DAYS }), value: pct(response.pct), sub: t("contracts.decided", { met: response.met, total: response.met + response.breached }), bad: response.pct !== null && response.pct < 0.9 },
    { label: t("contracts.resolutionCompliance", { days: WINDOW_DAYS }), value: pct(resolution.pct), sub: t("contracts.decided", { met: resolution.met, total: resolution.met + resolution.breached }), bad: resolution.pct !== null && resolution.pct < 0.9 },
    {
      label: t("contracts.visitsThisYear"),
      value: contract.includedVisits ? `${visits} / ${contract.includedVisits}` : String(visits),
      sub: t("contracts.yearRange", { from: date(year.from), to: date(new Date(year.to.getTime() - 86_400_000)) }),
      bad: false,
    },
  ];

  return (
    <>
      <BackLink href="/contracts" label={t("nav.contracts")} />
      <PageHeader
        title={contract.name}
        description={contract.client.name}
        actions={
          canManage && (
            <>
              <Link href={`/contracts/${id}/edit`}>
                <Button variant="secondary">
                  <Pencil className="size-4" />
                  {t("common.edit")}
                </Button>
              </Link>
              <span className="inline-flex items-center rounded-md border border-border bg-surface px-1">
                <ConfirmIconButton action={deleteContractAction.bind(null, id)} title={t("common.delete")} confirmText={t("contracts.deleteConfirm")}>
                  <Trash2 className="size-4" />
                </ConfirmIconButton>
              </span>
            </>
          )
        }
      />
      <div className="-mt-3 mb-5">
        <ContractStatusBadge status={contract.status} endDate={contract.endDate} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            {tiles.map((x) => (
              <Card key={x.label} className="p-4">
                <div className="text-xs text-muted">{x.label}</div>
                <div className={cn("mt-1 text-2xl font-semibold", x.bad && "text-danger")}>{x.value}</div>
                <div className="mt-0.5 text-xs text-muted">{x.sub}</div>
              </Card>
            ))}
          </div>

          <Card>
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="font-medium">{t("contracts.coveredWork")}</h2>
              <span className="text-xs text-muted">{t("contracts.linkedCount", { count: linkedTotal })}</span>
            </div>
            {judged.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted">{t("contracts.noWork")}</p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>{t("wo.title")}</th>
                    <th>{t("common.status")}</th>
                    <th>{t("contracts.responseShort")}</th>
                    <th>{t("contracts.resolutionShort")}</th>
                  </tr>
                </thead>
                <tbody>
                  {judged.slice(0, 25).map(({ w, s }) => (
                    <tr key={w.id}>
                      <td>
                        <Link href={`/work-orders/${w.id}`} className="font-medium hover:text-brand">
                          {docRef(w)} · {w.title}
                        </Link>
                        <div className="text-xs text-muted">
                          {dt(w.createdAt)}
                          {w.villa && ` · ${w.villa.name}`}
                        </div>
                      </td>
                      <td>
                        <WorkOrderStatusBadge status={w.status} />
                      </td>
                      <td>
                        <SlaBadge state={s.response} />
                      </td>
                      <td>
                        <SlaBadge state={s.resolution} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <dl className="space-y-2.5 text-sm">
              {terms.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[120px_1fr] gap-2">
                  <dt className="text-muted">{k}</dt>
                  <dd className="min-w-0">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 border-t border-border pt-3 text-xs text-muted">{t("contracts.autoLinkHint")}</p>
          </Card>
          {contract.notes && (
            <Card className="p-5">
              <h2 className="mb-2 font-medium">{t("common.notes")}</h2>
              <p className="whitespace-pre-wrap text-sm">{contract.notes}</p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
