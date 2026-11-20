import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui";
import type { AppContext } from "@/lib/context";
import { hoursPeople, hoursVillas } from "@/lib/timesheet";
import { EntryForm, type EntryDefaults } from "./entry-form";

/** The add / change hours screen (shared by /hours/new and /hours/[id]). */
export async function EntryPage({ ctx, entryId, defaults, next }: { ctx: AppContext; entryId: string | null; defaults: EntryDefaults; next: string }) {
  const t = await getTranslations("hours");
  const manager = ctx.can("timesheets.manage");
  const [villas, people] = await Promise.all([hoursVillas(ctx, defaults.userId, defaults.villaId), manager ? hoursPeople(ctx) : null]);
  // The person being edited may no longer log hours (role changed): keep them in the list.
  if (people && !people.some((p) => p.id === defaults.userId)) {
    const u = await ctx.db.membership.findFirst({ where: { userId: defaults.userId }, select: { user: { select: { name: true } } } });
    people.unshift({ id: defaults.userId, name: u?.user.name ?? "—" });
  }
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center gap-2">
        <Link href={next} className="rounded p-1 text-muted hover:bg-gray-100" aria-label={t("back")}>
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-lg font-semibold">{entryId ? t("editHours") : t("logHours")}</h1>
      </div>
      <Card className="p-4">
        <EntryForm entryId={entryId} defaults={defaults} villas={villas} people={people} next={next} />
      </Card>
    </div>
  );
}

/** `next` from the query string, when it is a path inside /hours. */
export const nextParam = (v: string | string[] | undefined) => (typeof v === "string" && /^\/hours(\/[\w/?=&.-]*)?$/.test(v) ? v : "/hours");
