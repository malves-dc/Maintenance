import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui";
import { getContext } from "@/lib/context";
import { titled } from "@/lib/metadata";
import { timesheetSettings, todayOf } from "@/lib/timesheet";
import { dateToDay, withinEditWindow } from "@/lib/timesheet-rules";
import { EntryPage, nextParam } from "../entry-page";

export const generateMetadata = titled("hours.editHours");

export default async function EditHoursPage({ params, searchParams }: PageProps<"/horas/[id]">) {
  const ctx = await getContext();
  const manager = ctx.can("timesheets.manage");
  const { id } = await params;
  const e = await ctx.db.timesheetEntry.findFirst({ where: { id } });
  if (!e || (!manager && e.userId !== ctx.user.id)) notFound();
  const day = dateToDay(e.date);
  if (!withinEditWindow(day, todayOf(ctx), timesheetSettings(ctx.organization).editDays, manager)) {
    const t = await getTranslations("hours");
    return <Card className="mx-auto max-w-xl px-4 py-6 text-center text-sm text-muted">{t("errors.locked")}</Card>;
  }
  return (
    <EntryPage
      ctx={ctx}
      entryId={e.id}
      defaults={{ userId: e.userId, villaId: e.villaId, date: day, startTime: e.startTime, endTime: e.endTime, minutes: e.minutes, description: e.description }}
      next={nextParam((await searchParams).next)}
    />
  );
}
