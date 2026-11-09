import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { CalendarDays, Columns3, List, Plus } from "lucide-react";
import { Button, Card, PageHeader, Select, Table } from "@/components/ui";
import { FilterBar, Pagination } from "@/components/list-controls";
import { EmptyState } from "@/components/empty-state";
import { CategoryChip, PriorityText, SystemBadge, WorkOrderStatusBadge } from "@/components/badges";
import { getContext } from "@/lib/context";
import { pageOf, PAGE_SIZE, sp } from "@/lib/list";
import { ACTIVE_STATUSES } from "@/lib/work-orders";
import { cn } from "@/lib/utils";
import { Priority, SystemType, WorkOrderStatus } from "@/generated/prisma/enums";
import { woFilter, WO_ORDER } from "./filter";
import { BoardView } from "./board";
import { CalendarView } from "./calendar";
import { titled } from "@/lib/metadata";
import { docRef } from "@/lib/series";

export const generateMetadata = titled("nav.workOrders");

const WO_LIST_INCLUDE = {
  villa: { select: { id: true, name: true } },
  asset: { select: { id: true, name: true } },
  assignees: { select: { user: { select: { id: true, name: true } } } },
  categories: { select: { id: true, name: true, color: true }, orderBy: { name: "asc" } },
} as const;

export default async function WorkOrdersPage({ searchParams }: PageProps<"/work-orders">) {
  const ctx = await getContext();
  if (!ctx.can("internal.view")) notFound();
  const t = await getTranslations();
  const format = await getFormatter();
  const raw = await searchParams;
  const view = sp(raw, "view") ?? "list";
  const billing = ctx.can("billing.view") || ctx.can("billing.manage");
  // The calendar opens on the technician's own jobs; managers see everyone's. "all" keeps an explicit "anyone".
  const mineByDefault = view === "calendar" && !ctx.can("workOrders.manage");
  const params = !sp(raw, "assignee") && mineByDefault ? { ...raw, assignee: "me" } : raw;
  const now = new Date();

  const [villas, members, categories] = await Promise.all([
    ctx.db.villa.findMany({ where: { archivedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    ctx.db.membership.findMany({ where: { active: true, role: { not: "REQUESTER" } }, select: { user: { select: { id: true, name: true } } } }),
    ctx.db.category.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const viewHref = (v: string) => {
    const q = new URLSearchParams(Object.entries(raw).filter(([k, val]) => typeof val === "string" && k !== "view" && k !== "page") as [string, string][]);
    if (v !== "list") q.set("view", v);
    return `/work-orders${q.size ? `?${q}` : ""}`;
  };

  let content: React.ReactNode;
  if (view === "board") {
    const where = woFilter(params, ctx.user.id, { ignoreStatus: true, billing });
    const recentDone = new Date(now.getTime() - 14 * 86_400_000);
    const wos = await ctx.db.workOrder.findMany({
      where: { ...where, OR: [{ status: { in: ACTIVE_STATUSES } }, { status: "DONE", completedAt: { gte: recentDone } }], AND: where.OR ? [{ OR: where.OR }] : [] },
      include: WO_LIST_INCLUDE,
      orderBy: WO_ORDER,
      take: 300,
    });
    content = (
      <BoardView
        canExecute={ctx.can("workOrders.execute")}
        workOrders={wos.map((w) => ({
          id: w.id,
          number: docRef(w),
          title: w.title,
          status: w.status,
          priority: w.priority,
          villa: w.villa?.name ?? null,
          due: w.dueDate ? format.dateTime(w.dueDate, { day: "numeric", month: "short" }) : null,
          overdue: !!w.dueDate && w.dueDate < now && w.status !== "DONE",
          assignees: w.assignees.map((a) => a.user.name),
        }))}
      />
    );
  } else if (view === "calendar") {
    content = <CalendarView ctx={ctx} params={params} />;
  } else {
    const where = woFilter(params, ctx.user.id, { billing });
    const { page, skip, take } = pageOf(params);
    const [wos, total] = await Promise.all([
      ctx.db.workOrder.findMany({ where, include: WO_LIST_INCLUDE, orderBy: WO_ORDER, skip, take }),
      ctx.db.workOrder.count({ where }),
    ]);
    content =
      wos.length === 0 ? (
        <EmptyState title={t("wo.empty")} />
      ) : (
        <>
          <Card>
            <Table>
              <thead>
                <tr>
                  <th>{t("wo.title")}</th>
                  <th>{t("common.status")}</th>
                  <th className="hidden md:table-cell">{t("assets.location")}</th>
                  <th className="hidden lg:table-cell">{t("wo.assignees")}</th>
                  <th>{t("wo.dueDate")}</th>
                </tr>
              </thead>
              <tbody>
                {wos.map((w) => {
                  const overdue = !!w.dueDate && w.dueDate < now && ACTIVE_STATUSES.includes(w.status);
                  return (
                    <tr key={w.id} className="hover:bg-gray-50">
                      <td>
                        <Link href={`/work-orders/${w.id}`} className="font-medium hover:text-brand">
                          <span className="mr-1.5 font-mono text-xs text-muted">{docRef(w)}</span>
                          {w.title}
                        </Link>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2">
                          {w.system && <SystemBadge system={w.system} />}
                          <PriorityText priority={w.priority} />
                          {w.categories.map((c) => (
                            <CategoryChip key={c.id} name={c.name} color={c.color} />
                          ))}
                          {billing && w.invoicedAt && (
                            <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                              {w.invoiceNumber ? t("billing.invoicedAs", { number: w.invoiceNumber }) : t("billing.invoiced")}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <WorkOrderStatusBadge status={w.status} />
                      </td>
                      <td className="hidden md:table-cell">
                        {w.villa?.name ?? "—"}
                        {w.asset && <div className="text-xs text-muted">{w.asset.name}</div>}
                      </td>
                      <td className="hidden text-muted lg:table-cell">{w.assignees.map((a) => a.user.name).join(", ") || "—"}</td>
                      <td className={cn("whitespace-nowrap", overdue ? "font-medium text-danger" : "text-muted")}>
                        {w.dueDate ? format.dateTime(w.dueDate, { dateStyle: "medium" }) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Card>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} />
        </>
      );
  }

  const views = [
    { key: "list", icon: List, label: t("wo.viewList") },
    { key: "board", icon: Columns3, label: t("wo.viewBoard") },
    { key: "calendar", icon: CalendarDays, label: t("wo.viewCalendar") },
  ];

  return (
    <>
      <PageHeader
        title={t("nav.workOrders")}
        actions={
          ctx.can("workOrders.create") && (
            <Link href="/work-orders/new">
              <Button>
                <Plus className="size-4" />
                {t("wo.new")}
              </Button>
            </Link>
          )
        }
      />
      <div className="mb-3 inline-flex rounded-md border border-border bg-surface p-0.5">
        {views.map((v) => (
          <Link
            key={v.key}
            href={viewHref(v.key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm",
              view === v.key ? "bg-brand text-brand-foreground" : "text-muted hover:text-foreground",
            )}
          >
            <v.icon className="size-4" />
            {v.label}
          </Link>
        ))}
      </div>
      <FilterBar searchPlaceholder={t("wo.searchPlaceholder")}>
        {view !== "list" && <input type="hidden" name="view" value={view} />}
        {view === "list" && (
          <Select name="status" defaultValue={sp(params, "status") ?? ""}>
            <option value="">{t("wo.statusActive")}</option>
            {Object.values(WorkOrderStatus).map((s) => (
              <option key={s} value={s}>
                {t(`woStatus.${s}`)}
              </option>
            ))}
            <option value="all">{t("wo.statusAll")}</option>
          </Select>
        )}
        <Select name="assignee" defaultValue={sp(params, "assignee") ?? "all"}>
          <option value="all">{t("wo.anyone")}</option>
          <option value="me">{t("wo.assignedToMe")}</option>
          <option value="unassigned">{t("wo.unassigned")}</option>
          {members
            .map((m) => m.user)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
        </Select>
        <Select name="villaId" defaultValue={sp(params, "villaId") ?? ""}>
          <option value="">{t("assets.allVillas")}</option>
          {villas.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </Select>
        <Select name="system" defaultValue={sp(params, "system") ?? ""}>
          <option value="">{t("assets.allSystems")}</option>
          {Object.values(SystemType).map((s) => (
            <option key={s} value={s}>
              {t(`systems.${s}`)}
            </option>
          ))}
        </Select>
        <Select name="priority" defaultValue={sp(params, "priority") ?? ""}>
          <option value="">{t("wo.anyPriority")}</option>
          {Object.values(Priority).map((p) => (
            <option key={p} value={p}>
              {t(`priority.${p}`)}
            </option>
          ))}
        </Select>
        {categories.length > 0 && (
          <Select name="category" defaultValue={sp(params, "category") ?? ""}>
            <option value="">{t("categories.all")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        )}
        <Select name="overdue" defaultValue={sp(params, "overdue") ?? ""}>
          <option value="">{t("wo.anyDue")}</option>
          <option value="1">{t("wo.overdueOnly")}</option>
        </Select>
        {billing && (
          <Select name="invoiced" defaultValue={sp(params, "invoiced") ?? ""}>
            <option value="">{t("billing.any")}</option>
            <option value="no">{t("billing.notInvoiced")}</option>
            <option value="yes">{t("billing.invoiced")}</option>
          </Select>
        )}
      </FilterBar>
      {content}
    </>
  );
}
