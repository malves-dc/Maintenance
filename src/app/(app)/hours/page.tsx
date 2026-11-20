import Link from "next/link";
import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui";
import { getContext } from "@/lib/context";
import { titled } from "@/lib/metadata";
import { hoursRows, hoursVillas, timesheetSettings, todayOf, villaLabel } from "@/lib/timesheet";
import { addDays, formatMinutes, monthStart, weekStart, withinEditWindow } from "@/lib/timesheet-rules";
import { EntryRows } from "./entry-rows";
import { InstallHours } from "./install-button";
import { TimerCard } from "./timer-card";

export const generateMetadata = titled("nav.hours");

/** Today: the timer, a button to log hours, today's time and the week so far. */
export default async function HoursTodayPage() {
  const ctx = await getContext();
  if (!ctx.can("timesheets.log")) redirect("/hours/entries");
  const t = await getTranslations("hours");
  const format = await getFormatter();
  const { editDays, dailyMinutes } = timesheetSettings(ctx.organization);
  const today = todayOf(ctx);
  const ws = weekStart(today);
  const from = monthStart(today) < ws ? monthStart(today) : ws;
  const [rows, timer, villas] = await Promise.all([
    hoursRows(ctx, { from, to: today, userIds: [ctx.user.id] }),
    ctx.db.timesheetTimer.findFirst({ where: { userId: ctx.user.id }, include: { villa: { select: { name: true, code: true } } } }),
    hoursVillas(ctx, ctx.user.id),
  ]);
  const sum = (a: string, b: string) => rows.filter((r) => r.date >= a && r.date <= b).reduce((s, r) => s + r.minutes, 0);
  const todays = rows.filter((r) => r.date === today);
  const week = Array.from({ length: 7 }, (_, i) => addDays(ws, i)).map((d) => ({ d, m: sum(d, d) }));
  const max = Math.max(dailyMinutes, ...week.map((w) => w.m));

  return (
    <div className="space-y-5">
      <InstallHours />
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: t("today"), m: sum(today, today), sub: t("ofDay", { h: formatMinutes(dailyMinutes) }) },
          { label: t("thisWeek"), m: sum(ws, today) },
          { label: t("thisMonth"), m: sum(monthStart(today), today) },
        ].map((k) => (
          <Card key={k.label} className="p-3">
            <div className="text-xs text-muted">{k.label}</div>
            <div className="text-xl font-semibold tabular-nums">{formatMinutes(k.m)}</div>
            {k.sub && <div className="text-xs text-muted">{k.sub}</div>}
          </Card>
        ))}
      </div>

      <TimerCard
        timer={timer ? { villa: villaLabel(timer.villa), startedAt: timer.startedAt.toISOString(), description: timer.description } : null}
        villas={villas}
        startedLabel={timer ? t("startedAt", { time: format.dateTime(timer.startedAt, { hour: "2-digit", minute: "2-digit" }) }) : null}
      />

      <Link href="/hours/new" className="flex h-12 items-center justify-center gap-2 rounded-md bg-brand font-semibold text-brand-foreground hover:opacity-90">
        <Plus className="size-5" /> {t("logHours")}
      </Link>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t("today")}</h2>
        {todays.length ? (
          <EntryRows
            rows={todays}
            editable={(r) => withinEditWindow(r.date, today, editDays, ctx.can("timesheets.manage"))}
            linkWorkOrders={ctx.can("internal.view")}
            next="/hours"
          />
        ) : (
          <Card className="px-4 py-6 text-center text-sm text-muted">{t("nothingToday")}</Card>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t("thisWeek")}</h2>
        <Card className="grid grid-cols-7 gap-1 p-3">
          {week.map(({ d, m }) => (
            <Link key={d} href={`/hours/entries?week=${ws}`} aria-label={`${format.dateTime(new Date(`${d}T12:00:00Z`), { weekday: "long", timeZone: "UTC" })}: ${formatMinutes(m)}`} className="flex flex-col items-center gap-1 text-xs">
              <div className="flex h-20 w-full items-end justify-center">
                <div
                  className={`w-5 rounded-t ${m >= dailyMinutes ? "bg-brand" : m > 0 ? "bg-brand/50" : "bg-gray-100"}`}
                  style={{ height: `${Math.max(4, (m / max) * 100)}%` }}
                  title={formatMinutes(m)}
                />
              </div>
              <span className={d === today ? "font-semibold" : "text-muted"}>{format.dateTime(new Date(`${d}T12:00:00Z`), { weekday: "short", timeZone: "UTC" })}</span>
              <span className="tabular-nums text-muted">{m ? formatMinutes(m) : "–"}</span>
            </Link>
          ))}
        </Card>
      </section>
      {rows.length === 0 && <p className="text-center text-xs text-muted">{t("woTimeNote")}</p>}
    </div>
  );
}
