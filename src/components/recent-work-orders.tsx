import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { WorkOrderStatusBadge } from "@/components/badges";
import type { AppContext } from "@/lib/context";
import type { Prisma } from "@/generated/prisma/client";
import { docRef } from "@/lib/series";

/** Card with the latest work orders matching `where`, plus a create button with prefill query. */
export async function RecentWorkOrders({
  ctx,
  where,
  newHref,
  viewAllHref,
  take = 8,
  title,
  orderBy = { createdAt: "desc" },
}: {
  ctx: AppContext;
  where: Prisma.WorkOrderWhereInput;
  newHref: string;
  viewAllHref: string;
  take?: number;
  title?: string;
  orderBy?: Prisma.WorkOrderOrderByWithRelationInput[] | Prisma.WorkOrderOrderByWithRelationInput;
}) {
  const t = await getTranslations();
  const format = await getFormatter();
  const wos = await ctx.db.workOrder.findMany({
    where,
    select: { id: true, year: true, number: true, title: true, status: true, dueDate: true, completedAt: true, createdAt: true },
    orderBy,
    take,
  });

  return (
    <Card>
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h2 className="font-medium">{title ?? t("nav.workOrders")}</h2>
        <div className="flex items-center gap-3">
          {wos.length > 0 && (
            <Link href={viewAllHref} className="text-sm text-brand">
              {t("common.viewAll")}
            </Link>
          )}
          {ctx.can("workOrders.create") && (
            <Link href={newHref}>
              <Button size="sm" variant="secondary">
                <Plus className="size-4" />
                {t("wo.new")}
              </Button>
            </Link>
          )}
        </div>
      </div>
      {wos.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted">{t("wo.noneHere")}</p>
      ) : (
        <ul className="divide-y divide-border">
          {wos.map((w) => (
            <li key={w.id}>
              <Link href={`/work-orders/${w.id}`} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm hover:bg-gray-50">
                <span className="min-w-0 truncate">
                  <span className="mr-1.5 font-mono text-xs text-muted">{docRef(w)}</span>
                  {w.title}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="hidden text-xs text-muted sm:inline">
                    {format.dateTime(w.completedAt ?? w.dueDate ?? w.createdAt, { dateStyle: "medium" })}
                  </span>
                  <WorkOrderStatusBadge status={w.status} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
