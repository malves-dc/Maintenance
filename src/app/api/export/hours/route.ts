import { getTranslations } from "next-intl/server";
import { reportFilter } from "@/app/(app)/horas/report-filter";
import { getContext } from "@/lib/context";
import { csvResponse, toCsv } from "@/lib/csv";
import { hoursRows, todayOf } from "@/lib/timesheet";
import { hoursDecimal } from "@/lib/timesheet-rules";

/** Hours (typed and on work orders) over a period as CSV: the Hours report's filters (timesheets.manage). */
export async function GET(req: Request) {
  const ctx = await getContext();
  if (!ctx.can("timesheets.manage")) return new Response("Not found", { status: 404 });
  const t = await getTranslations("hours");
  const f = reportFilter(Object.fromEntries(new URL(req.url).searchParams), todayOf(ctx));
  const rows = await hoursRows(ctx, f);
  const header = [t("date"), t("person"), t("villaCode"), t("villa"), t("start"), t("end"), t("hoursCol"), t("source"), t("description")];
  const body = rows.map((r) => [
    r.date,
    r.userName,
    r.villaCode,
    r.villaName,
    r.startTime,
    r.endTime,
    hoursDecimal(r.minutes),
    r.kind === "wo" ? t("workOrder") : t("typed"),
    r.description,
  ]);
  return csvResponse(`${t("csvName")}_${f.from}_${f.to}.csv`, toCsv(header, body));
}
