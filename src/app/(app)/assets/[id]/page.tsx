import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { ChevronRight, Pencil, Plus, Printer } from "lucide-react";
import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { ArchiveButton } from "@/components/archive-button";
import { SecretField } from "@/components/secret-field";
import { AssetStatusBadge, CriticalityText, SystemBadge } from "@/components/badges";
import { getContext } from "@/lib/context";
import { assetQrUrl, qrSvg } from "@/lib/qr";
import { daysFromNow } from "@/lib/dates";
import { setAssetArchivedAction } from "../actions";
import { StatusControl } from "./status-control";
import { RecentWorkOrders } from "@/components/recent-work-orders";
import { MetersPanel } from "../../meters/meters-panel";
import { CompatibleParts } from "../../parts/compatible-parts";
import { villaClient } from "@/lib/villa-client";

const WARRANTY_SOON_DAYS = 60;

export default async function AssetPage({ params }: PageProps<"/assets/[id]">) {
  const { id } = await params;
  const ctx = await getContext();
  if (!ctx.can("internal.view")) notFound();
  const t = await getTranslations();
  const format = await getFormatter();

  const asset = await ctx.db.asset.findUnique({
    where: { id },
    include: {
      villa: { select: { id: true, name: true, client: { select: { id: true, name: true } }, manager: { select: { id: true, name: true } }, billTo: true } },
      area: { select: { name: true } },
      parent: { select: { id: true, name: true } },
      vendor: { select: { id: true, name: true } },
      children: { where: { archivedAt: null }, select: { id: true, name: true, system: true, status: true, category: true }, orderBy: { name: "asc" } },
      statusLogs: { include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!asset) notFound();

  const qr = await qrSvg(await assetQrUrl(asset.qrToken));
  const canManage = ctx.can("assets.manage");
  const warrantyDays = asset.warrantyExpiry ? daysFromNow(asset.warrantyExpiry) : null;
  const date = (d: Date | null) => (d ? format.dateTime(d, { dateStyle: "medium" }) : null);

  const details: [string, React.ReactNode][] = [
    [t("assets.category"), asset.category],
    [t("assets.manufacturer"), asset.manufacturer],
    [t("assets.model"), asset.model],
    [t("assets.serialNumber"), asset.serialNumber && <span className="font-mono">{asset.serialNumber}</span>],
    [t("assets.code"), asset.code && <span className="font-mono">{asset.code}</span>],
    [t("assets.criticality"), <CriticalityText key="c" value={asset.criticality} />],
    [t("assets.installDate"), date(asset.installDate)],
    [
      t("assets.warrantyExpiry"),
      asset.warrantyExpiry && (
        <span key="w">
          {date(asset.warrantyExpiry)}{" "}
          {warrantyDays! < 0 ? (
            <Badge className="bg-gray-100">{t("assets.warrantyExpired")}</Badge>
          ) : warrantyDays! <= WARRANTY_SOON_DAYS ? (
            <Badge className="bg-amber-50 text-amber-800">{t("assets.warrantySoon", { days: warrantyDays! })}</Badge>
          ) : null}
        </span>
      ),
    ],
    [t("assets.purchaseCost"), asset.purchaseCost && format.number(Number(asset.purchaseCost), { style: "currency", currency: ctx.organization.currency })],
    [t("assets.vendor"), asset.vendor?.name],
  ];
  const network: [string, string | null][] = [
    [t("assets.ipAddress"), asset.ipAddress],
    [t("assets.macAddress"), asset.macAddress],
    [t("assets.vlan"), asset.vlan],
    [t("assets.firmware"), asset.firmware],
  ];
  const hasNetwork = network.some(([, v]) => v);

  return (
    <>
      <BackLink href={`/villas/${asset.villa.id}`} label={asset.villa.name} />
      <nav className="mb-1 flex flex-wrap items-center gap-1 text-xs text-muted">
        {villaClient(asset.villa) && (
          <>
            <Link href={`/clients/${villaClient(asset.villa)!.id}`} className="hover:text-foreground">
              {villaClient(asset.villa)!.name}
            </Link>
            <ChevronRight className="size-3" />
          </>
        )}
        <Link href={`/villas/${asset.villa.id}`} className="hover:text-foreground">
          {asset.villa.name}
        </Link>
        {asset.area && (
          <>
            <ChevronRight className="size-3" />
            {asset.area.name}
          </>
        )}
        {asset.parent && (
          <>
            <ChevronRight className="size-3" />
            <Link href={`/assets/${asset.parent.id}`} className="hover:text-foreground">
              {asset.parent.name}
            </Link>
          </>
        )}
      </nav>
      <PageHeader
        title={asset.name}
        actions={
          canManage && (
            <>
              <ArchiveButton archived={!!asset.archivedAt} action={setAssetArchivedAction.bind(null, asset.id)} />
              <Link href={`/assets/${asset.id}/edit`}>
                <Button variant="secondary">
                  <Pencil className="size-4" />
                  {t("common.edit")}
                </Button>
              </Link>
            </>
          )
        }
      />
      <div className="-mt-3 mb-6 flex flex-wrap items-center gap-2">
        <SystemBadge system={asset.system} />
        <AssetStatusBadge status={asset.status} />
        {asset.archivedAt && <Badge>{t("common.archived")}</Badge>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <Card className="p-5">
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              {details
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-muted">{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
            </dl>
            {asset.notes && <p className="mt-4 whitespace-pre-wrap border-t border-border pt-4 text-sm">{asset.notes}</p>}
          </Card>

          {hasNetwork && (
            <Card className="p-5">
              <h2 className="mb-3 font-medium">{t("assets.sectionNetwork")}</h2>
              <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
                {network.map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-muted">{k}</dt>
                    <dd className="font-mono text-xs">{v ?? "—"}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          )}

          <MetersPanel ctx={ctx} assetId={asset.id} />

          <CompatibleParts ctx={ctx} assetId={asset.id} />

          <RecentWorkOrders ctx={ctx} where={{ assetId: asset.id }} newHref={`/work-orders/new?assetId=${asset.id}`} viewAllHref={`/work-orders?assetId=${asset.id}&status=all`} />

          <Card>
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="font-medium">{t("assets.children")}</h2>
              {canManage && (
                <Link href={`/assets/new?parentId=${asset.id}`}>
                  <Button size="sm" variant="secondary">
                    <Plus className="size-4" />
                    {t("assets.addChild")}
                  </Button>
                </Link>
              )}
            </div>
            {asset.children.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted">{t("assets.noChildren")}</p>
            ) : (
              <ul className="divide-y divide-border">
                {asset.children.map((c) => (
                  <li key={c.id}>
                    <Link href={`/assets/${c.id}`} className="flex items-center justify-between gap-2 px-5 py-2.5 text-sm hover:bg-gray-50">
                      <span>
                        {c.name}
                        {c.category && <span className="ml-2 text-xs text-muted">{c.category}</span>}
                      </span>
                      <AssetStatusBadge status={c.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 font-medium">{t("assets.statusHistory")}</h2>
            <ol className="space-y-3 border-l border-border pl-4 text-sm">
              {asset.statusLogs.map((log) => (
                <li key={log.id} className="relative">
                  <span className="absolute -left-[1.3rem] top-1.5 size-2 rounded-full bg-gray-300" />
                  <div className="flex flex-wrap items-center gap-2">
                    <AssetStatusBadge status={log.status} />
                    <span className="text-xs text-muted">
                      {format.dateTime(log.createdAt, { dateStyle: "medium", timeStyle: "short" })}
                      {log.user && ` · ${log.user.name}`}
                    </span>
                  </div>
                  {log.note && <p className="mt-1 text-muted">{log.note}</p>}
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-6">
          {canManage && (
            <Card className="p-5">
              <h2 className="mb-3 font-medium">{t("common.status")}</h2>
              <StatusControl id={asset.id} status={asset.status} />
            </Card>
          )}

          <Card className="p-5">
            <h2 className="mb-2 font-medium">{t("assets.credentials")}</h2>
            <SecretField kind="asset" id={asset.id} hasValue={!!asset.credentialsEnc} canView={ctx.can("secrets.view")} canEdit={canManage} />
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 font-medium">{t("assets.qrCode")}</h2>
            <div className="mx-auto w-40 [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} />
            <p className="mt-3 text-center text-xs text-muted">{t("assets.qrHint")}</p>
            <Link href={`/assets/labels?ids=${asset.id}`} className="mt-3 block">
              <Button variant="secondary" size="sm" className="w-full">
                <Printer className="size-4" />
                {t("assets.printLabel")}
              </Button>
            </Link>
          </Card>
        </div>
      </div>
    </>
  );
}
