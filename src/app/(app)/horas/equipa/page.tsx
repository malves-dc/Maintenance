import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, Table } from "@/components/ui";
import { getContext } from "@/lib/context";
import { titled } from "@/lib/metadata";
import { hoursPeople, hoursRows, timesheetSettings, todayOf, villaLabel } from "@/lib/timesheet";
import { addDays, formatMinutes, isDay, weekStart } from "@/lib/timesheet-rules";

export const generateMetadata = titled("hours.tabs.team");

/** Managers: who is on the clock now, and everyone's week day by day (short days in amber). */
export default async function HoursTeamPage({ searchParams }: PageProps<"/horas/equipa">) {
  const ctx = await getContext();
  if (!ctx.can("timesheets.manage")) notFound();
  const t = await getTranslations("hours");
  const format = await getFormatter();
  const sp = await searchParams;
  const today = todayOf(ctx);
  const ws = weekStart(typeof sp.week === "string" && isDay(sp.week) ? sp.week : today);
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const { dailyMinutes } = timesheetSettings(ctx.organization);
  const [people, rows, timers] = await Promise.all([
    hoursPeople(ctx),
    hoursRows(ctx, { from: ws, to: days[6] }),
    ctx.db.timesheetTimer.findMany({ include: { user: { select: { name: true } }, villa: { select: { name: true, code: true } } }, orderBy: { startedAt: "asc" } }),
  ]);
  // Anyone with time this week shows, even without the permission any more.
  for (const r of rows) if (!people.some((p) => p.id === r.userId)) people.push({ id: r.userId, name: r.userName });
  const cell = (userId: string, d: string) => rows.filter((r) => r.userId === userId && r.date === d).reduce((s, r) => s + r.minutes, 0);
  const workday = (d: string) => new Date(`${d}T12:00:00Z`).getUTCDay() % 6 !== 0;
  const q = (w: string) => `/horas/equipa?week=${w}`;

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t("onTheClock")}</h2>
        {timers.length ? (
          <Card className="divide-y divide-border">
            {timers.map((tm) => (
              <div key={tm.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="size-2 rounded-full bg-brand" />
                <span className="font-medium">{tm.user.name}</span>
                <span className="min-w-0 flex-1 truncate text-muted">{villaLabel(tm.villa)}</span>
                <span className="tabular-nums text-muted">{t("since", { time: format.dateTime(tm.startedAt, { hour: "2-digit", minute: "2-digit" }) })}</span>
              </div>
            ))}
          </Card>
        ) : (
          <Card className="px-4 py-3 text-sm text-muted">{t("noTimers")}</Card>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <h2 className="flex-1 text-sm font-semibold uppercase tracking-wide text-muted">
            {t("weekOf", { date: format.dateTime(new Date(`${ws}T12:00:00Z`), { day: "numeric", month: "long", timeZone: "UTC" }) })}
          </h2>
          <Link href={q(addDays(ws, -7))} className="rounded-md border border-border p-1.5 hover:bg-gray-50" aria-label={t("prevWeek")}>
            <ChevronLeft className="size-4" />
          </Link>
          <Link href={q(addDays(ws, 7))} className="rounded-md border border-border p-1.5 hover:bg-gray-50" aria-label={t("nextWeek")}>
            <ChevronRight className="size-4" />
          </Link>
        </div>
        <Card>
          <Table className="[&_td]:px-2 [&_th]:px-2 [&_td]:text-right [&_th]:text-right [&_td:first-child]:text-left [&_th:first-child]:text-left">
            <thead>
              <tr>
                <th>{t("person")}</th>
                {days.map((d) => (
                  <th key={d} className={d === today ? "text-foreground" : ""}>
                    {format.dateTime(new Date(`${d}T12:00:00Z`), { weekday: "short", day: "numeric", timeZone: "UTC" })}
                  </th>
                ))}
                <th>{t("total")}</th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => {
                const week = days.map((d) => cell(p.id, d));
                return (
                  <tr key={p.id}>
                    <td className="font-medium">
                      <Link href={`/horas/registos?week=${ws}&user=${p.id}`} className="hover:underline">
                        {p.name}
                      </Link>
                    </td>
                    {days.map((d, i) => {
                      const short = workday(d) && d < today && week[i] < dailyMinutes;
                      return (
                        <td key={d} className={`tabular-nums ${short ? "bg-amber-50 text-amber-700" : week[i] > 24 * 60 ? "text-danger" : ""}`}>
                          {week[i] ? formatMinutes(week[i]) : workday(d) && d <= today ? "0" : "–"}
                        </td>
                      );
                    })}
                    <td className="font-semibold tabular-nums">{formatMinutes(week.reduce((s, m) => s + m, 0))}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
        <p className="text-xs text-muted">{t("teamNote", { h: formatMinutes(dailyMinutes) })}</p>
      </section>
    </div>
  );
}
