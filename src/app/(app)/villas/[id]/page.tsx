import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { MapPin, Pencil, Plus, QrCode } from "lucide-react";
import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { ArchiveButton } from "@/components/archive-button";
import { SecretField } from "@/components/secret-field";
import { AssetStatusBadge, SystemBadge } from "@/components/badges";
import { getContext } from "@/lib/context";
import { flattenTree } from "@/lib/tree";
import { setVillaArchivedAction } from "../actions";
import { AreasManager } from "./areas";
import { RecentWorkOrders } from "@/components/recent-work-orders";
import type { SystemType } from "@/generated/prisma/enums";
import { villaClient } from "@/lib/villa-client";

export default async function VillaPage({ params }: PageProps<"/villas/[id]">) {
  const { id } = await params;
  const ctx = await getContext();
  if (!ctx.can("internal.view")) notFound();
  const t = await getTranslations();

  const villa = await ctx.db.villa.findUnique({
    where: { id },
    include: {
      client: { include: { contacts: { orderBy: { isPrimary: "desc" }, take: 3 } } },
      manager: { include: { contacts: { orderBy: { isPrimary: "desc" }, take: 3 } } },
      areas: { include: { _count: { select: { assets: { where: { archivedAt: null } } } } } },
      assets: {
        where: { archivedAt: null },
        select: { id: true, name: true, system: true, status: true, category: true, parentId: true, area: { select: { name: true } } },
        orderBy: { name: "asc" },
      },
    },
  });
  if (!villa) notFound();
  const contacts = villaClient(villa)?.contacts ?? [];

  const areas = flattenTree(villa.areas).map((a) => ({
    id: a.id,
    name: a.name,
    kind: a.kind,
    parentId: a.parentId,
    depth: a.depth,
    assetCount: a._count.assets,
  }));

  const bySystem = new Map<SystemType, typeof villa.assets>();
  for (const a of villa.assets) bySystem.set(a.system, [...(bySystem.get(a.system) ?? []), a]);
  const issues = villa.assets.filter((a) => a.status === "DOWN" || a.status === "DEGRADED");

  const mapsQuery =
    villa.latitude != null && villa.longitude != null
      ? `${villa.latitude},${villa.longitude}`
      : [villa.address, villa.city, villa.country].filter(Boolean).join(", ");
  const canManage = ctx.can("clients.manage");

  return (
    <>
      <BackLink href="/villas" label={t("nav.villas")} />
      <PageHeader
        title={villa.name}
        description={villa.code ?? undefined}
        actions={
          <>
            {canManage && <ArchiveButton archived={!!villa.archivedAt} action={setVillaArchivedAction.bind(null, villa.id)} />}
            {canManage && (
              <Link href={`/villas/${villa.id}/edit`}>
                <Button variant="secondary">
                  <Pencil className="size-4" />
                  {t("common.edit")}
                </Button>
              </Link>
            )}
            {ctx.can("assets.manage") && (
              <Link href={`/assets/new?villaId=${villa.id}`}>
                <Button>
                  <Plus className="size-4" />
                  {t("assets.new")}
                </Button>
              </Link>
            )}
          </>
        }
      />
      {villa.archivedAt && <Badge className="mb-4">{t("common.archived")}</Badge>}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {issues.length > 0 && (
            <Card className="border-amber-200 bg-amber-50/40 p-4">
              <h2 className="mb-2 text-sm font-medium">{t("villas.needsAttention")}</h2>
              <ul className="space-y-1 text-sm">
                {issues.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2">
                    <Link href={`/assets/${a.id}`} className="hover:text-brand">
                      {a.name}
                    </Link>
                    <AssetStatusBadge status={a.status} />
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="font-medium">{t("villas.systems")}</h2>
              <div className="flex gap-3 text-sm">
                {villa.assets.length > 0 && (
                  <Link href={`/assets/labels?villaId=${villa.id}`} className="inline-flex items-center gap-1 text-muted hover:text-brand">
                    <QrCode className="size-4" />
                    {t("assets.printLabels")}
                  </Link>
                )}
                <Link href={`/assets?villaId=${villa.id}`} className="text-brand">
                  {t("common.viewAll")}
                </Link>
              </div>
            </div>
            {bySystem.size === 0 ? (
              <p className="px-5 py-6 text-sm text-muted">{t("assets.emptyVilla")}</p>
            ) : (
              <div className="divide-y divide-border">
                {[...bySystem.entries()].map(([system, list]) => (
                  <div key={system} className="px-5 py-3">
                    <div className="mb-2 flex items-center justify-between">
                      <SystemBadge system={system} />
                      <Link href={`/assets?villaId=${villa.id}&system=${system}`} className="text-xs text-muted hover:text-brand">
                        {t("assets.count", { count: list.length })}
                      </Link>
                    </div>
                    <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                      {list.slice(0, 8).map((a) => (
                        <li key={a.id} className="flex items-center justify-between gap-2 truncate">
                          <Link href={`/assets/${a.id}`} className="truncate hover:text-brand">
                            {a.name}
                            {a.area && <span className="ml-1.5 text-xs text-muted">· {a.area.name}</span>}
                          </Link>
                          {a.status !== "OPERATIONAL" && <AssetStatusBadge status={a.status} />}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <RecentWorkOrders ctx={ctx} where={{ villaId: villa.id }} newHref={`/work-orders/new?villaId=${villa.id}`} viewAllHref={`/work-orders?villaId=${villa.id}&status=all`} />

          <Card>
            <div className="border-b border-border px-5 py-3">
              <h2 className="font-medium">{t("areas.title")}</h2>
            </div>
            <AreasManager villaId={villa.id} areas={areas} canEdit={ctx.can("assets.manage")} />
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="space-y-3 p-5 text-sm">
            {villa.client && (
              <div>
                <div className="text-xs text-muted">{t("villas.owner")}</div>
                <Link href={`/clients/${villa.client.id}`} className="font-medium hover:text-brand">
                  {villa.client.name}
                </Link>
              </div>
            )}
            {villa.manager && (
              <div>
                <div className="text-xs text-muted">{t("villas.manager")}</div>
                <Link href={`/clients/${villa.manager.id}`} className="font-medium hover:text-brand">
                  {villa.manager.name}
                </Link>
              </div>
            )}
            {villa.client && villa.manager && (
              <div>
                <div className="text-xs text-muted">{t("villas.billTo")}</div>
                <div>{villaClient(villa)!.name}</div>
              </div>
            )}
            {mapsQuery && (
              <div>
                <div className="text-xs text-muted">{t("villas.address")}</div>
                <div>{[villa.address, villa.city, villa.country].filter(Boolean).join(", ") || mapsQuery}</div>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-brand"
                >
                  <MapPin className="size-3.5" />
                  {t("villas.openMaps")}
                </a>
              </div>
            )}
            {contacts.length > 0 && (
              <div>
                <div className="text-xs text-muted">{t("clients.contacts")}</div>
                {contacts.map((c) => (
                  <div key={c.id}>
                    {c.name}
                    {c.role && <span className="text-muted"> · {c.role}</span>}
                    {c.phone && (
                      <a href={`tel:${c.phone}`} className="block text-xs text-brand">
                        {c.phone}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="mb-2 font-medium">{t("villas.accessNotes")}</h2>
            <p className="whitespace-pre-wrap text-sm">{villa.accessNotes || <span className="text-muted">—</span>}</p>
          </Card>

          <Card className="p-5">
            <h2 className="mb-2 font-medium">{t("villas.secrets")}</h2>
            <SecretField
              kind="villa"
              id={villa.id}
              hasValue={!!villa.secretsEnc}
              canView={ctx.can("secrets.view")}
              canEdit={canManage}
            />
          </Card>
        </div>
      </div>
    </>
  );
}
