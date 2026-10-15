import { getTranslations } from "next-intl/server";
import { getContext } from "@/lib/context";
import { parseReportFilters } from "@/lib/report-filters";
import { assetReport, costReport, slaReport, technicianReport, woScope } from "@/lib/reports";
import { SLA_STATUS_LOGS, slaCalendar, slaStates } from "@/lib/sla";
import { workOrderCosts } from "@/lib/work-orders";
import { timeRoundingOf } from "@/lib/billing-time";
import { urgentRuleFor } from "@/lib/urgent-surcharge";
import { csvResponse, money, moneyColumns, toCsv, type Cell, type Column } from "@/lib/csv";
import { villaClient } from "@/lib/villa-client";

const r2 = (n: number | null) => (n === null ? null : Math.round(n * 100) / 100);

/** CSV versions of the report tables, with the same filters as the page. */
export async function GET(req: Request, { params }: RouteContext<"/reports/export/[kind]">) {
  const { kind } = await params;
  const ctx = await getContext();
  if (!ctx.can("reports.view")) return new Response("Not found", { status: 404 });
  // Without "See costs": no cost export, and no money columns in the others (moneyColumns below).
  if (kind === "costs" && !ctx.can("costs.view")) return new Response("Not found", { status: 404 });
  const f = parseReportFilters(Object.fromEntries(new URL(req.url).searchParams));
  const t = await getTranslations();
  // Spreadsheet-friendly "2026-09-28 14:05" in the organisation's time zone.
  const tz = new Intl.DateTimeFormat("sv-SE", { timeZone: ctx.organization.timezone, dateStyle: "short", timeStyle: "short" });
  const when = (d: Date | null) => (d ? tz.format(d) : null);
  const span = `${f.from.toISOString().slice(0, 10)}_${f.to.toISOString().slice(0, 10)}`;
  const sys = (s: string | null) => (s ? t(`systems.${s}` as never) : null);
  const now = new Date();

  let header: Column[];
  let rows: Cell[][];
  switch (kind) {
    case "work-orders": {
      const wos = await ctx.db.workOrder.findMany({
        where: { ...woScope(f), createdAt: { gte: f.from, lte: f.to } },
        include: {
          villa: { select: { name: true, client: { select: { name: true } }, manager: { select: { name: true } }, billTo: true } },
          asset: { select: { name: true } },
          contract: { select: { name: true, responseTimeHours: true, resolutionTimeHours: true, businessHoursOnly: true, pauseOnHold: true, urgentFee: true, urgentPercent: true } },
          statusLogs: SLA_STATUS_LOGS,
          timeEntries: { select: { userId: true, minutes: true, hourlyRate: true } },
          parts: { select: { quantity: true, unitCost: true } },
          otherCosts: { select: { amount: true } },
        },
        orderBy: { number: "asc" },
      });
      header = [
        t("reports.csv.number"), t("wo.title"), t("wo.type"), t("common.status"), t("wo.priority"), t("assets.system"),
        t("villas.client"), t("assets.villa"), t("wo.asset"), t("wo.createdAt"), t("reports.csv.firstResponse"), t("wo.completedAt"),
        t("contracts.contract"), t("contracts.responseShort"), t("contracts.resolutionShort"), t("reports.csv.minutes"), t("reports.csv.billedMinutes"),
        money(t("costs.labor")), money(t("costs.parts")), money(t("reports.otherCosts")), money(t("costs.urgent")), money(t("costs.total")),
      ];
      rows = wos.map((w) => {
        const c = workOrderCosts(w, timeRoundingOf(ctx.organization.timeRounding), urgentRuleFor(ctx.organization, w.contract));
        const s = w.contract ? slaStates(w, w.contract, now, slaCalendar(ctx.organization)) : null;
        return [
          w.number, w.title, t(`woType.${w.type}`), t(`woStatus.${w.status}`), t(`priority.${w.priority}`), sys(w.system),
          w.villa && villaClient(w.villa)?.name, w.villa?.name, w.asset?.name, when(w.createdAt), when(w.firstResponseAt), when(w.completedAt),
          w.contract?.name, s && s.response !== "na" ? t(`sla.${s.response}`) : null, s && s.resolution !== "na" ? t(`sla.${s.resolution}`) : null,
          c.minutes, c.billedMinutes, r2(c.labor), r2(c.parts), r2(c.other), r2(c.urgent), r2(c.total),
        ];
      });
      break;
    }
    case "sla": {
      const s = await slaReport(ctx, f, now);
      header = [t("reports.csv.number"), t("wo.title"), t("contracts.contract"), t("villas.client"), t("assets.villa"), t("wo.createdAt"), t("contracts.respondBy"), t("reports.csv.firstResponse"), t("contracts.responseShort"), t("contracts.resolveBy"), t("wo.completedAt"), t("contracts.resolutionShort")];
      rows = s.judged.map((w) => [
        w.number, w.title, w.contract!.name, w.contract!.client.name, w.villa?.name, when(w.createdAt),
        when(w.sla.responseDue), when(w.firstResponseAt), w.sla.response === "na" ? null : t(`sla.${w.sla.response}`),
        when(w.sla.resolutionDue), when(w.completedAt), w.sla.resolution === "na" ? null : t(`sla.${w.sla.resolution}`),
      ]);
      break;
    }
    case "costs": {
      const c = await costReport(ctx, f);
      header = [t("assets.villa"), t("reports.jobs"), money(t("costs.labor")), money(t("costs.parts")), money(t("reports.otherCosts")), money(t("costs.urgent")), money(t("costs.total"))];
      rows = c.byVilla.map((v) => [v.name, v.count, r2(v.labor), r2(v.parts), r2(v.other), r2(v.urgent), r2(v.total)]);
      break;
    }
    case "technicians": {
      const r = await technicianReport(ctx, f);
      header = [t("reports.person"), t("reports.hoursCol"), t("reports.billedHoursCol"), `${t("reports.utilisation")} (%)`, t("reports.jobsWorked"), t("reports.jobsCompleted"), money(t("costs.labor"))];
      rows = r.people.map((p) => [p.name, r2(p.hours), r2(p.billedHours), p.utilisation === null ? null : r2(p.utilisation * 100), p.jobs, p.completed, r2(p.labor)]);
      break;
    }
    case "assets": {
      const a = await assetReport(ctx, f);
      header = [t("wo.asset"), t("assets.villa"), t("assets.system"), t("common.status"), t("reports.csv.downHours"), t("reports.csv.degradedHours"), `${t("reports.availability")} (%)`, t("reports.repairs")];
      rows = a.rows.map((r) => [r.name, r.villa, sys(r.system), t(`assetStatus.${r.status}`), r2(r.downHours), r2(r.degradedHours), r.availability === null ? null : r2(r.availability * 100), r.failures]);
      break;
    }
    default:
      return new Response("Not found", { status: 404 });
  }
  const csv = moneyColumns(header, rows, ctx.can("costs.view"));
  return csvResponse(`${kind}_${span}.csv`, toCsv(csv.header, csv.rows));
}
