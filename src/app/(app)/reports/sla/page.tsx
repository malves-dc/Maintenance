import Link from "next/link";
import { Table } from "@/components/ui";
import { BarList } from "@/components/charts/bars";
import { StatTile } from "@/components/charts/stat-tile";
import { SlaBadge } from "@/components/badges";
import { slaReport } from "@/lib/reports";
import { ExportLink, loadReport, Section } from "../common";
import { docRef } from "@/lib/series";

export default async function SlaReportPage({ searchParams }: PageProps<"/reports/sla">) {
  const { ctx, f, t, pct, day, format } = await loadReport(searchParams);
  const s = await slaReport(ctx, f);
  const decided = (c: { met: number; breached: number }) => t("reports.decided", { met: c.met, total: c.met + c.breached });
  const dt = (d: Date) => format.dateTime(d, { dateStyle: "short", timeStyle: "short" });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">{t("reports.slaNote", { from: day(f.from), to: day(f.to) })}</p>
        <ExportLink kind="sla" f={f} label={t("reports.exportCsv")} />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatTile label={t("reports.underContract")} value={format.number(s.total)} />
        <StatTile label={t("reports.kpi.slaResponse")} value={pct(s.response.pct)} sub={decided(s.response)} alert={s.response.pct !== null && s.response.pct < 0.9} />
        <StatTile label={t("reports.kpi.slaResolution")} value={pct(s.resolution.pct)} sub={decided(s.resolution)} alert={s.resolution.pct !== null && s.resolution.pct < 0.9} />
      </div>

      {s.contracts.length === 0 ? (
        <Section title={t("reports.byContract")}>
          <p className="text-sm text-muted">{t("reports.noContracts")}</p>
          <Link href="/contracts" className="mt-2 inline-block text-sm font-medium text-brand">
            {t("nav.contracts")}
          </Link>
        </Section>
      ) : (
        <Section title={t("reports.byContract")} note={t("reports.resolutionByContract")}>
          <BarList
            rows={s.contracts
              .filter((c) => c.resolution.pct !== null)
              .map((c) => ({ key: c.id, label: c.name, sub: c.client, value: c.resolution.pct!, display: pct(c.resolution.pct), href: `/contracts/${c.id}` }))}
            empty={t("reports.noDecided")}
          />
          <Table className="mt-5">
            <thead>
              <tr>
                <th>{t("contracts.contract")}</th>
                <th className="text-right">{t("reports.jobs")}</th>
                <th className="text-right">{t("contracts.responseShort")}</th>
                <th className="text-right">{t("contracts.resolutionShort")}</th>
                <th className="text-right">{t("reports.breaches")}</th>
              </tr>
            </thead>
            <tbody>
              {s.contracts.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/contracts/${c.id}`} className="font-medium hover:text-brand">
                      {c.name}
                    </Link>
                    <div className="text-xs text-muted">{c.client}</div>
                  </td>
                  <td className="text-right tabular-nums">{c.count}</td>
                  <td className="text-right tabular-nums">{pct(c.response.pct)}</td>
                  <td className="text-right tabular-nums">{pct(c.resolution.pct)}</td>
                  <td className="text-right tabular-nums">{c.response.breached + c.resolution.breached}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Section>
      )}

      <Section title={t("reports.breachedJobs")} note={t("reports.latest50")}>
        {s.breaches.length === 0 ? (
          <p className="text-sm text-muted">{t("reports.noBreaches")}</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>{t("wo.title")}</th>
                <th>{t("contracts.responseShort")}</th>
                <th>{t("contracts.resolutionShort")}</th>
              </tr>
            </thead>
            <tbody>
              {s.breaches.map((w) => (
                <tr key={w.id}>
                  <td>
                    <Link href={`/work-orders/${w.id}`} className="font-medium hover:text-brand">
                      {docRef(w)} · {w.title}
                    </Link>
                    <div className="text-xs text-muted">
                      {dt(w.createdAt)} · {w.contract!.name}
                      {w.villa && ` · ${w.villa.name}`}
                    </div>
                  </td>
                  <td>
                    <SlaBadge state={w.sla.response} />
                  </td>
                  <td>
                    <SlaBadge state={w.sla.resolution} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Section>
    </div>
  );
}
