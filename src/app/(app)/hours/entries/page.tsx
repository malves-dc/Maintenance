import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Card } from "@/components/ui";
import { getContext } from "@/lib/context";
import { titled } from "@/lib/metadata";
import { hoursPeople, hoursRows, timesheetSettings, todayOf } from "@/lib/timesheet";
import { addDays, formatMinutes, isDay, weekStart, withinEditWindow } from "@/lib/timesheet-rules";
import { EntryRows } from "../entry-rows";
import { PersonPicker } from "./person-picker";

export const generateMetadata = titled("hours.tabs.entries");

/** One week of someone's time, day by day: one's own, or anyone's with timesheets.manage. */
export default async function HoursEntriesPage({ searchParams }: PageProps<"/hours/entries">) {
  const ctx = await getContext();
  const manager = ctx.can("timesheets.manage");
  const t = await getTranslations("hours");
  const format = await getFormatter();
  const sp = await searchParams;
  const today = todayOf(ctx);
  const ws = weekStart(typeof sp.week === "string" && isDay(sp.week) ? sp.week : today);
  const we = addDays(ws, 6);
  const people = manager ? await hoursPeople(ctx) : [];
  const userId = manager && typeof sp.user === "string" && sp.user ? sp.user : ctx.user.id;
  const { editDays, dailyMinutes } = timesheetSettings(ctx.organization);
  const rows = await hoursRows(ctx, { from: ws, to: we, userIds: [userId] });
  const total = rows.reduce((s, r) => s + r.minutes, 0);
  const self = userId === ctx.user.id;
  const canAdd = manager || ctx.can("timesheets.log");
  const q = (week: string) => `/hours/entries?week=${week}${self ? "" : `&user=${userId}`}`;
  const here = q(ws);
  const linkWorkOrders = ctx.can("internal.view");
  const dayTitle = (d: string) => format.dateTime(new Date(`${d}T12:00:00Z`), { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

  return (
    <div className="space-y-4">
      {manager && <PersonPicker people={people} value={userId} self={ctx.user.id} week={ws} />}
      <div className="flex items-center gap-2">
        <Link href={q(addDays(ws, -7))} className="rounded-md border border-border p-2 hover:bg-gray-50" aria-label={t("prevWeek")}>
          <ChevronLeft className="size-4" />
        </Link>
        <div className="flex-1 text-center">
          <div className="font-semibold">
            {format.dateTime(new Date(`${ws}T12:00:00Z`), { day: "numeric", month: "short", timeZone: "UTC" })} –{" "}
            {format.dateTime(new Date(`${we}T12:00:00Z`), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}
          </div>
          <div className="text-xs text-muted">{t("weekTotal", { total: formatMinutes(total) })}</div>
        </div>
        <Link href={q(addDays(ws, 7))} className="rounded-md border border-border p-2 hover:bg-gray-50" aria-label={t("nextWeek")}>
          <ChevronRight className="size-4" />
        </Link>
      </div>
      {ws !== weekStart(today) && (
        <div className="text-center">
          <Link href={q(weekStart(today))} className="text-sm text-muted underline">
            {t("thisWeek")}
          </Link>
        </div>
      )}

      {Array.from({ length: 7 }, (_, i) => addDays(ws, i)).map((d) => {
        const dayRows = rows.filter((r) => r.date === d);
        const m = dayRows.reduce((s, r) => s + r.minutes, 0);
        const weekend = new Date(`${d}T12:00:00Z`).getUTCDay() % 6 === 0;
        if (!dayRows.length && (weekend || d > today)) return null;
        const open = canAdd && (manager || (d <= today && withinEditWindow(d, today, editDays, false)));
        return (
          <section key={d} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <h2 className={`flex-1 text-sm font-semibold first-letter:uppercase ${d === today ? "" : "text-muted"}`}>{dayTitle(d)}</h2>
              <span className={`text-sm tabular-nums ${m > 0 && m < dailyMinutes && d < today ? "text-amber-700" : "text-muted"}`}>{formatMinutes(m)}</span>
              {open && (
                <Link
                  href={`/hours/new?date=${d}${self ? "" : `&user=${userId}`}&next=${encodeURIComponent(here)}`}
                  className="rounded p-1 text-muted hover:bg-gray-100 hover:text-foreground"
                  title={t("logHours")}
                  aria-label={t("logHours")}
                >
                  <Plus className="size-4" />
                </Link>
              )}
            </div>
            {dayRows.length ? (
              <EntryRows rows={dayRows} editable={(r) => withinEditWindow(r.date, today, editDays, manager)} linkWorkOrders={linkWorkOrders} next={here} />
            ) : (
              <Card className="px-4 py-3 text-sm text-muted">{t("noHours")}</Card>
            )}
          </section>
        );
      })}
    </div>
  );
}
