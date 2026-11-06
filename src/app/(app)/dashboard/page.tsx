import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CircleCheck, Circle, Search } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { getContext } from "@/lib/context";
import { RecentWorkOrders } from "@/components/recent-work-orders";
import { OnCallNow } from "@/components/on-call-calendar";
import { ACTIVE_STATUSES } from "@/lib/work-orders";
import { lowStockParts } from "@/lib/inventory";
import { titled } from "@/lib/metadata";

export const generateMetadata = titled("nav.dashboard");

export default async function DashboardPage() {
  const ctx = await getContext();
  const t = await getTranslations("dashboard");
  const { db } = ctx;
  const now = new Date();

  if (!ctx.can("internal.view")) {
    return <PageHeader title={t("greeting", { name: ctx.user.name.split(" ")[0] })} />;
  }

  const [open, overdue, pending, villas, assets, members] = await Promise.all([
    db.workOrder.count({ where: { status: { in: ACTIVE_STATUSES } } }),
    db.workOrder.count({ where: { status: { in: ACTIVE_STATUSES }, dueDate: { lt: now } } }),
    db.request.count({ where: { status: "PENDING" } }),
    db.villa.count({ where: { archivedAt: null } }),
    db.asset.count({ where: { archivedAt: null } }),
    db.membership.count(),
  ]);
  const [pmCount, low, toApprove] = await Promise.all([
    db.pMSchedule.count({ where: { active: true } }),
    lowStockParts(db),
    ctx.can("purchasing.approve") ? db.purchaseOrder.count({ where: { status: "PENDING_APPROVAL" } }) : 0,
  ]);

  const stats: { label: string; value: number; alert?: boolean; href?: string }[] = [
    { label: t("openWorkOrders"), value: open, href: "/work-orders" },
    { label: t("overdue"), value: overdue, alert: overdue > 0, href: "/work-orders?overdue=1" },
    { label: t("pendingRequests"), value: pending, href: "/requests" },
    { label: t("lowStock"), value: low.length, alert: low.length > 0, href: "/parts?stock=low" },
    ...(toApprove ? [{ label: t("poApprovals"), value: toApprove, alert: true, href: "/purchase-orders?status=PENDING_APPROVAL" }] : []),
    { label: t("villas"), value: villas, href: "/villas" },
    { label: t("assets"), value: assets, href: "/assets" },
  ];

  const steps = [
    { label: t("step1"), done: members > 1, href: "/settings/users" },
    { label: t("step2"), done: villas > 0, href: "/villas" },
    { label: t("step3"), done: assets > 0, href: "/assets" },
    { label: t("step4"), done: pmCount > 0, href: "/preventive" },
  ];

  return (
    <>
      <PageHeader title={t("greeting", { name: ctx.user.name.split(" ")[0] })} description={t("subtitle")} />

      {/* Fuzzy search over every work order and its notes (/search). */}
      <form action="/search" role="search" className="relative mb-6">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <input
          name="q"
          type="search"
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
          className="h-11 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      </form>

      <OnCallNow ctx={ctx} href="/on-call" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <Link key={s.label} href={s.href ?? "#"}>
            <Card className="h-full p-4 transition hover:border-brand/40">
              <div className="text-xs text-muted">{s.label}</div>
              <div className={`mt-1 text-2xl font-semibold tabular-nums ${s.alert ? "text-danger" : ""}`}>{s.value}</div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <RecentWorkOrders
          ctx={ctx}
          title={t("myWorkOrders")}
          where={{ status: { in: ACTIVE_STATUSES }, assignees: { some: { userId: ctx.user.id } } }}
          orderBy={[{ dueDate: { sort: "asc", nulls: "last" } }, { priority: "desc" }]}
          newHref="/work-orders/new"
          viewAllHref="/work-orders?assignee=me"
        />
        <RecentWorkOrders
          ctx={ctx}
          title={t("overdueWorkOrders")}
          where={{ status: { in: ACTIVE_STATUSES }, dueDate: { lt: now } }}
          orderBy={{ dueDate: "asc" }}
          newHref="/work-orders/new"
          viewAllHref="/work-orders?overdue=1"
        />
      </div>

      {steps.some((s) => !s.done) && (
        <Card className="mt-6 p-5">
          <h2 className="mb-3 font-medium">{t("gettingStarted")}</h2>
          <ul className="space-y-2">
            {steps.map((s) => (
              <li key={s.label} className="flex items-center gap-2.5 text-sm">
                {s.done ? <CircleCheck className="size-4 text-green-600" /> : <Circle className="size-4 text-muted" />}
                {s.done ? (
                  <span className="text-muted line-through">{s.label}</span>
                ) : (
                  <Link href={s.href} className="hover:text-brand">
                    {s.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
