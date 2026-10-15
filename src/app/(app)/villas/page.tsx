import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { Button, Card, PageHeader, Select, Table } from "@/components/ui";
import { FilterBar, Pagination } from "@/components/list-controls";
import { EmptyState } from "@/components/empty-state";
import { getContext } from "@/lib/context";
import { pageOf, PAGE_SIZE, searchWhere, sp } from "@/lib/list";
import { titled } from "@/lib/metadata";
import { villaClient } from "@/lib/villa-client";

export const generateMetadata = titled("nav.villas");

export default async function VillasPage({ searchParams }: PageProps<"/villas">) {
  const ctx = await getContext();
  if (!ctx.can("internal.view")) notFound();
  const t = await getTranslations();
  const params = await searchParams;
  const q = sp(params, "q");
  const clientId = sp(params, "clientId");
  const archived = sp(params, "archived") === "1";
  const { page, skip, take } = pageOf(params);

  const where = {
    archivedAt: archived ? { not: null } : null,
    // A client's villas: owned or managed by it.
    ...(clientId ? { AND: [{ OR: [{ clientId }, { managerId: clientId }] }] } : {}),
    ...searchWhere(q, ["name", "code", "city", "address"]),
  };
  const [villas, total, clients] = await Promise.all([
    ctx.db.villa.findMany({
      where,
      include: {
        client: { select: { id: true, name: true } },
        manager: { select: { id: true, name: true } },
        _count: {
          select: {
            assets: { where: { archivedAt: null } },
            workOrders: { where: { status: { in: ["OPEN", "IN_PROGRESS", "ON_HOLD"] } } },
          },
        },
      },
      orderBy: { name: "asc" },
      skip,
      take,
    }),
    ctx.db.villa.count({ where }),
    ctx.db.client.findMany({ where: { archivedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <PageHeader
        title={t("nav.villas")}
        description={t("villas.description")}
        actions={
          ctx.can("clients.manage") && (
            <Link href="/villas/new">
              <Button>
                <Plus className="size-4" />
                {t("villas.new")}
              </Button>
            </Link>
          )
        }
      />
      <FilterBar searchPlaceholder={t("common.search")}>
        <Select name="clientId" defaultValue={clientId ?? ""}>
          <option value="">{t("villas.allClients")}</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select name="archived" defaultValue={archived ? "1" : ""}>
          <option value="">{t("common.active")}</option>
          <option value="1">{t("common.archived")}</option>
        </Select>
      </FilterBar>

      {villas.length === 0 ? (
        <EmptyState
          title={q || clientId ? t("common.noResults") : t("villas.empty")}
          description={clients.length === 0 ? t("villas.needClient") : undefined}
        />
      ) : (
        <Card>
          <Table>
            <thead>
              <tr>
                <th>{t("common.name")}</th>
                <th>{t("villas.owner")}</th>
                <th>{t("villas.city")}</th>
                <th className="text-right">{t("nav.assets")}</th>
                <th className="text-right">{t("villas.openWorkOrders")}</th>
              </tr>
            </thead>
            <tbody>
              {villas.map((v) => (
                <tr key={v.id} className="hover:bg-gray-50">
                  <td>
                    <Link href={`/villas/${v.id}`} className="font-medium hover:text-brand">
                      {v.name}
                    </Link>
                    {v.code && <span className="ml-2 font-mono text-xs text-muted">{v.code}</span>}
                  </td>
                  <td>
                    {(v.client ?? v.manager) && (
                      <Link href={`/clients/${(v.client ?? v.manager)!.id}`} className="text-muted hover:text-brand">
                        {(v.client ?? v.manager)!.name}
                      </Link>
                    )}
                    {v.client && v.manager && (
                      <span className="block text-xs text-muted">
                        {t("villas.managedBy", { name: v.manager.name })}
                        {villaClient(v) === v.manager && ` · ${t("villas.billed")}`}
                      </span>
                    )}
                  </td>
                  <td className="text-muted">{v.city ?? "—"}</td>
                  <td className="text-right tabular-nums">{v._count.assets}</td>
                  <td className="text-right tabular-nums">{v._count.workOrders}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} />
    </>
  );
}
