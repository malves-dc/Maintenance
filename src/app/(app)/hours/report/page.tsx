import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Download } from "lucide-react";
import { DateInput } from "@/components/date-input";
import { Button, Card, Select, Table } from "@/components/ui";
import { getContext } from "@/lib/context";
import { titled } from "@/lib/metadata";
import { hoursPeople, hoursRows, todayOf, villaLabel, type HoursRow } from "@/lib/timesheet";
import { formatMinutes } from "@/lib/timesheet-rules";
import { reportFilter, reportQuery } from "../report-filter";

export const generateMetadata = titled("hours.tabs.report");

type Group = { key: string; label: string; minutes: number; hours: number; wo: number; others: Set<string> };

function groupBy(rows: HoursRow[], key: (r: HoursRow) => string, label: (r: HoursRow) => string, other: (r: HoursRow) => string) {
  const map = new Map<string, Group>();
  for (const r of rows) {
    const k = key(r);
    const g = map.get(k) ?? { key: k, label: label(r), minutes: 0, hours: 0, wo: 0, others: new Set<string>() };
    g.minutes += r.minutes;
    if (r.kind === "hours") g.hours += r.minutes;
    else g.wo += r.minutes;
    g.others.add(other(r));
    map.set(k, g);
  }
  return [...map.values()].sort((a, b) => b.minutes - a.minutes);
}

/** Managers: hours per villa and per person over a period, with a spreadsheet export. */
export default async function HoursReportPage({ searchParams }: PageProps<"/hours/report">) {
  const ctx = await getContext();
  if (!ctx.can("timesheets.manage")) notFound();
  const t = await getTranslations("hours");
  const f = reportFilter(await searchParams, todayOf(ctx));
  const [rows, people, villas] = await Promise.all([
    hoursRows(ctx, f),
    hoursPeople(ctx),
    ctx.db.villa.findMany({ select: { id: true, name: true, code: true }, orderBy: [{ code: "asc" }, { name: "asc" }] }),
  ]);
  const total = rows.reduce((s, r) => s + r.minutes, 0);
  const typed = rows.filter((r) => r.kind === "hours").reduce((s, r) => s + r.minutes, 0);
  const byVilla = groupBy(rows, (r) => r.villaId ?? "-", (r) => (r.villaId ? villaLabel({ name: r.villaName, code: r.villaCode }) : t("noVilla")), (r) => r.userId);
  const byPerson = groupBy(rows, (r) => r.userId, (r) => r.userName, (r) => r.villaId ?? "-");
  const split = (g: Group) => (
    <span className="text-xs text-muted">
      {formatMinutes(g.hours)} + {formatMinutes(g.wo)}
    </span>
  );

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <form method="get" className="grid grid-cols-2 gap-3 sm:grid-cols-5 sm:items-end">
          <label className="space-y-1 text-sm">
            <span className="font-medium">{t("from")}</span>
            <DateInput name="from" defaultValue={f.from} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">{t("to")}</span>
            <DateInput name="to" defaultValue={f.to} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">{t("villa")}</span>
            <Select name="villa" defaultValue={f.villa ?? ""}>
              <option value="">{t("all")}</option>
              {villas.map((v) => (
                <option key={v.id} value={v.id}>
                  {villaLabel(v)}
                </option>
              ))}
            </Select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">{t("person")}</span>
            <Select name="user" defaultValue={f.user ?? ""}>
              <option value="">{t("all")}</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </label>
          <div className="col-span-2 flex gap-2 sm:col-span-1">
            <Button className="flex-1">{t("apply")}</Button>
            <a href={`/api/export/hours?${reportQuery(f)}`} className="inline-flex h-10 items-center rounded-md border border-border bg-surface px-3 hover:bg-gray-50" title={t("exportCsv")} aria-label={t("exportCsv")}>
              <Download className="size-4" />
            </a>
          </div>
        </form>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: t("total"), v: formatMinutes(total) },
          { label: t("typedHours"), v: formatMinutes(typed) },
          { label: t("woHours"), v: formatMinutes(total - typed) },
        ].map((k) => (
          <Card key={k.label} className="p-3">
            <div className="text-xs text-muted">{k.label}</div>
            <div className="text-xl font-semibold tabular-nums">{k.v}</div>
          </Card>
        ))}
      </div>

      {[
        { title: t("byVilla"), groups: byVilla, other: t("people") },
        { title: t("byPerson"), groups: byPerson, other: t("villas") },
      ].map((s) => (
        <section key={s.title} className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{s.title}</h2>
          {s.groups.length ? (
            <Card>
              <Table>
                <thead>
                  <tr>
                    <th></th>
                    <th className="text-right">{s.other}</th>
                    <th className="text-right">{t("total")}</th>
                    <th className="hidden text-right sm:table-cell">{t("splitHead")}</th>
                  </tr>
                </thead>
                <tbody>
                  {s.groups.map((g) => (
                    <tr key={g.key}>
                      <td className="font-medium">{g.label}</td>
                      <td className="text-right tabular-nums">{g.others.size}</td>
                      <td className="text-right font-semibold tabular-nums">{formatMinutes(g.minutes)}</td>
                      <td className="hidden text-right tabular-nums sm:table-cell">{split(g)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          ) : (
            <Card className="px-4 py-6 text-center text-sm text-muted">{t("noHours")}</Card>
          )}
        </section>
      ))}
    </div>
  );
}
