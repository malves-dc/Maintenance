import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui";
import { WO_STATUS_TONE } from "@/components/badges";
import type { AppContext } from "@/lib/context";
import { sp } from "@/lib/list";
import { cn } from "@/lib/utils";
import { woFilter } from "./filter";
import { recurrenceOf } from "@/lib/pm";
import { occurrencesBetween } from "@/lib/pm-schedule";
import { SystemType } from "@/generated/prisma/enums";
import { dayKey, scheduleDays, scheduledAt } from "@/lib/wo-schedule";
import { docRef } from "@/lib/series";

/**
 * Month grid (Monday first) of work orders in the organization's time zone: each job on the days from its start
 * to its due date (or just one of them), with the time on its first day.
 */
export async function CalendarView({ ctx, params }: { ctx: AppContext; params: Record<string, string | string[] | undefined> }) {
  const t = await getTranslations();
  const format = await getFormatter();
  const tz = ctx.organization.timezone;
  const today = dayKey(new Date(), tz);
  const monthParam = sp(params, "month");
  const [y, m] = (monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : today.slice(0, 7)).split("-").map(Number);

  // Grid covers whole weeks around the month; query with a day of slack for time zones.
  const first = new Date(Date.UTC(y, m - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const gridStart = new Date(Date.UTC(y, m - 1, 1 - offset));
  const days = Array.from({ length: 42 }, (_, i) => new Date(gridStart.getTime() + i * 86_400_000));
  const rangeStart = new Date(gridStart.getTime() - 86_400_000);
  const rangeEnd = new Date(gridStart.getTime() + 43 * 86_400_000);

  const wos = await ctx.db.workOrder.findMany({
    where: {
      ...woFilter(params, ctx.user.id, { ignoreStatus: true }),
      status: { not: "CANCELLED" },
      // Overlaps the grid: starts or is due inside it, or spans across it.
      AND: [
        {
          OR: [
            { startDate: { gte: rangeStart, lt: rangeEnd } },
            { dueDate: { gte: rangeStart, lt: rangeEnd } },
            { startDate: { lt: rangeStart }, dueDate: { gte: rangeEnd } },
          ],
        },
      ],
    },
    select: { id: true, year: true, number: true, title: true, status: true, startDate: true, dueDate: true },
    orderBy: [{ startDate: { sort: "asc", nulls: "last" } }, { dueDate: "asc" }],
    take: 1000,
  });
  // Forecast: future occurrences of active time-based PM schedules (not yet generated).
  const system = sp(params, "system");
  const schedules = await ctx.db.pMSchedule.findMany({
    where: {
      active: true,
      trigger: "TIME",
      nextDueAt: { not: null, lt: rangeEnd },
      ...(sp(params, "villaId") ? { villaId: sp(params, "villaId") } : {}),
      ...(system && system in SystemType ? { system: system as SystemType } : {}),
      ...(sp(params, "assignee") === "me" ? { assignees: { some: { userId: ctx.user.id } } } : {}),
    },
  });
  const planned = new Map<string, { id: string; title: string }[]>();
  for (const s of schedules) {
    const r = recurrenceOf(s, tz);
    if (!r) continue;
    const from = s.nextDueAt! > rangeStart ? s.nextDueAt! : rangeStart;
    for (const d of occurrencesBetween(r, from, rangeEnd, 45)) {
      const k = dayKey(d, tz);
      planned.set(k, [...(planned.get(k) ?? []), { id: s.id, title: s.title }]);
    }
  }

  type Entry = (typeof wos)[number] & { time: string | null; continued: boolean };
  const byDay = new Map<string, Entry[]>();
  for (const w of wos) {
    const at = scheduledAt(w)!;
    scheduleDays(w, tz).forEach((k, i) => {
      const entry = { ...w, time: i === 0 ? format.dateTime(at, { timeStyle: "short", timeZone: tz }) : null, continued: i > 0 };
      byDay.set(k, [...(byDay.get(k) ?? []), entry]);
    });
  }
  // Within a day: timed starts in time order, then jobs carried over from earlier days.
  for (const list of byDay.values()) list.sort((a, b) => Number(a.continued) - Number(b.continued) || (a.time ?? "").localeCompare(b.time ?? ""));

  const monthHref = (delta: number) => {
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => typeof v === "string") as [string, string][]);
    q.set("view", "calendar");
    q.set("month", `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
    return `/work-orders?${q}`;
  };
  const weekdays = days.slice(0, 7).map((d) => format.dateTime(d, { weekday: "short", timeZone: "UTC" }));

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <Link href={monthHref(-1)} className="rounded-md p-1.5 hover:bg-gray-100" aria-label={t("common.previous")}>
          <ChevronLeft className="size-4" />
        </Link>
        <h2 className="font-medium capitalize">{format.dateTime(first, { month: "long", year: "numeric", timeZone: "UTC" })}</h2>
        <Link href={monthHref(1)} className="rounded-md p-1.5 hover:bg-gray-100" aria-label={t("common.next")}>
          <ChevronRight className="size-4" />
        </Link>
      </div>
      <div className="grid grid-cols-7 border-b border-border text-center text-xs font-medium uppercase text-muted">
        {weekdays.map((w) => (
          <div key={w} className="py-2">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const key = d.toISOString().slice(0, 10);
          const inMonth = d.getUTCMonth() === m - 1;
          const list = byDay.get(key) ?? [];
          const plan = planned.get(key) ?? [];
          return (
            <div key={key} className={cn("min-h-24 border-b border-r border-border p-1 text-xs", !inMonth && "bg-gray-50/70")}>
              <div
                className={cn(
                  "mb-1 inline-flex size-6 items-center justify-center rounded-full",
                  key === today ? "bg-brand text-brand-foreground" : inMonth ? "" : "text-muted",
                )}
              >
                {d.getUTCDate()}
              </div>
              <div className="space-y-0.5">
                {list.slice(0, 4).map((w) => (
                  <Link
                    key={w.id}
                    href={`/work-orders/${w.id}`}
                    title={w.title}
                    className={cn(
                      "block truncate rounded px-1 py-0.5",
                      WO_STATUS_TONE[w.status],
                      w.status === "DONE" && "line-through opacity-70",
                      w.continued && "opacity-60",
                    )}
                  >
                    {w.time && <span className="mr-1 font-medium tabular-nums">{w.time}</span>}
                    {w.continued && "↳ "}{docRef(w)} {w.title}
                  </Link>
                ))}
                {list.length > 4 && <div className="px-1 text-muted">+{list.length - 4}</div>}
                {plan.slice(0, 3).map((p, i) => (
                  <Link
                    key={`${p.id}-${i}`}
                    href={`/preventive/${p.id}`}
                    title={`${t("pm.planned")}: ${p.title}`}
                    className="block truncate rounded border border-dashed border-gray-300 px-1 py-0.5 text-muted"
                  >
                    {p.title}
                  </Link>
                ))}
                {plan.length > 3 && <div className="px-1 text-muted">+{plan.length - 3}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
