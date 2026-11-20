import { monthStart, isDay } from "@/lib/timesheet-rules";

type SP = Record<string, string | string[] | undefined>;
const one = (sp: SP, k: string) => (typeof sp[k] === "string" && sp[k] !== "" ? (sp[k] as string) : undefined);

/** The report's period and filters from the query string (default: this month so far). */
export function reportFilter(sp: SP, today: string) {
  let from = one(sp, "from");
  let to = one(sp, "to");
  if (!from || !isDay(from)) from = monthStart(today);
  if (!to || !isDay(to)) to = today;
  if (to < from) [from, to] = [to, from];
  const villa = one(sp, "villa");
  const user = one(sp, "user");
  return { from, to, villaIds: villa ? [villa] : undefined, userIds: user ? [user] : undefined, villa, user };
}

export const reportQuery = (f: { from: string; to: string; villa?: string; user?: string }) =>
  new URLSearchParams(Object.entries(f).filter((e): e is [string, string] => !!e[1])).toString();
