import { redirect } from "next/navigation";
import { getContext } from "@/lib/context";
import { titled } from "@/lib/metadata";
import { todayOf } from "@/lib/timesheet";
import { isDay } from "@/lib/timesheet-rules";
import { EntryPage, nextParam } from "../entry-page";

export const generateMetadata = titled("hours.logHours");

export default async function NewHoursPage({ searchParams }: PageProps<"/horas/novo">) {
  const ctx = await getContext();
  const manager = ctx.can("timesheets.manage");
  if (!ctx.can("timesheets.log") && !manager) redirect("/dashboard");
  const sp = await searchParams;
  const date = typeof sp.date === "string" && isDay(sp.date) ? sp.date : todayOf(ctx);
  const userId = manager && typeof sp.user === "string" && sp.user ? sp.user : ctx.user.id;
  const villaId = typeof sp.villa === "string" ? sp.villa : null;
  return (
    <EntryPage
      ctx={ctx}
      entryId={null}
      defaults={{ userId, villaId, date, startTime: null, endTime: null, minutes: null, description: "" }}
      next={nextParam(sp.next)}
    />
  );
}
