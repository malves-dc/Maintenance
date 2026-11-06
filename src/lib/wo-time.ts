// Who logs time on a work order (pure; shared by the server, the page and the field app). Only the technicians
// assigned to the job log time, each their own, as many entries as the job takes; the company owner never does.
// Everyone assigned must have logged time before the job can be marked done.

export const canLogTime = (role: string, assigned: boolean) => assigned && role !== "OWNER";

type EntryLike = { userId?: string | null; minutes: number | null; endedAt?: Date | string | null };

/** Which of these technicians have no time on the job yet. A running timer counts: completing the job stops it. */
export function withoutTime<T extends { userId: string }>(technicians: T[], entries: EntryLike[]) {
  const logged = new Set(entries.filter((e) => (e.minutes ?? 0) > 0 || e.endedAt === null).map((e) => e.userId));
  return technicians.filter((t) => !logged.has(t.userId));
}
