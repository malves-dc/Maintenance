import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Pencil } from "lucide-react";
import { Badge, Button, Card, Field, Input, PageHeader, Select, Table } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { ActionForm, FieldError } from "@/components/action-form";
import { ArchiveButton } from "@/components/archive-button";
import { ConfirmIconButton } from "@/components/confirm-button";
import { AttachmentsPanel } from "@/components/attachments-panel";
import { LowStockBadge, PoStatusBadge, SystemBadge } from "@/components/badges";
import { getContext } from "@/lib/context";
import { fileUrl } from "@/lib/storage";
import { isLowStock, onHand, PO_OPEN_STATUSES, remainingQty } from "@/lib/inventory-math";
import { cn } from "@/lib/utils";
import {
  countStockAction,
  deletePartAttachmentAction,
  setLocationMinAction,
  setPartArchivedAction,
  transferStockAction,
  unlinkAssetPartAction,
} from "../actions";
import { docRef } from "@/lib/series";

export default async function PartPage({ params }: PageProps<"/parts/[id]">) {
  const { id } = await params;
  const ctx = await getContext();
  if (!ctx.can("internal.view")) notFound();
  const t = await getTranslations();
  const format = await getFormatter();

  const part = await ctx.db.part.findUnique({
    where: { id },
    include: {
      vendor: { select: { id: true, name: true } },
      stock: { select: { locationId: true, quantity: true, minQuantity: true } },
      assets: {
        where: { archivedAt: null },
        select: { id: true, name: true, villa: { select: { name: true } } },
        orderBy: { name: "asc" },
      },
      attachments: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!part) notFound();

  const [locations, movements, openPos] = await Promise.all([
    ctx.db.stockLocation.findMany({
      where: { archivedAt: null },
      include: { user: { select: { name: true } } },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    }),
    ctx.db.stockMovement.findMany({
      where: { partId: id },
      include: {
        location: { select: { name: true } },
        user: { select: { name: true } },
        workOrder: { select: { id: true, year: true, number: true } },
        purchaseOrder: { select: { id: true, number: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    ctx.can("purchasing.manage")
      ? ctx.db.purchaseOrder.findMany({
          where: { status: { in: PO_OPEN_STATUSES }, lines: { some: { partId: id } } },
          select: { id: true, number: true, status: true, lines: { where: { partId: id }, select: { quantity: true, receivedQuantity: true } } },
          orderBy: { number: "desc" },
        })
      : [],
  ]);

  const canManage = ctx.can("inventory.manage");
  const activeStock = part.stock.filter((s) => locations.some((l) => l.id === s.locationId));
  const low = isLowStock({ minQuantity: part.minQuantity, stock: activeStock });
  const total = onHand(activeStock);
  const qty = (n: number) => `${format.number(n)} ${part.unit}`;
  const money = (n: number) => format.number(n, { style: "currency", currency: ctx.organization.currency });
  const dt = (d: Date) => format.dateTime(d, { dateStyle: "short", timeStyle: "short" });
  const locationOptions = locations.map((l) => (
    <option key={l.id} value={l.id}>
      {l.name}
    </option>
  ));

  const details: [string, React.ReactNode][] = [
    [t("parts.sku"), part.sku && <span className="font-mono">{part.sku}</span>],
    [t("parts.barcode"), part.barcode && <span className="font-mono">{part.barcode}</span>],
    [t("assets.manufacturer"), part.manufacturer],
    [t("assets.model"), part.model],
    [t("parts.unitCost"), `${money(Number(part.unitCost))} / ${part.unit}`],
    [t("parts.purchaseCost"), `${money(Number(part.purchaseCost))} / ${part.unit}`],
    [t("parts.minQuantity"), Number(part.minQuantity) > 0 ? qty(Number(part.minQuantity)) : null],
    [t("parts.vendor"), part.vendor && <Link href={`/vendors/${part.vendor.id}`} className="hover:text-brand">{part.vendor.name}</Link>],
    [t("parts.stockValue"), money(total * Number(part.purchaseCost))], // stock is valued at cost
  ];

  return (
    <>
      <BackLink href="/parts" label={t("nav.parts")} />
      <PageHeader
        title={part.name}
        actions={
          canManage && (
            <>
              <ArchiveButton archived={!!part.archivedAt} action={setPartArchivedAction.bind(null, part.id)} />
              <Link href={`/parts/${part.id}/edit`}>
                <Button variant="secondary">
                  <Pencil className="size-4" />
                  {t("common.edit")}
                </Button>
              </Link>
            </>
          )
        }
      />
      <div className="-mt-3 mb-5 flex flex-wrap items-center gap-2">
        {part.system && <SystemBadge system={part.system} />}
        {low && <LowStockBadge />}
        {part.archivedAt && <Badge>{t("common.archived")}</Badge>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          <Card className="p-5">
            <div className="mb-4 flex items-baseline gap-2">
              <span className={cn("text-3xl font-semibold tabular-nums", low && "text-danger")}>{format.number(total)}</span>
              <span className="text-muted">
                {part.unit} {t("parts.onHandLower")}
              </span>
            </div>
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
            {part.description && <p className="mt-4 whitespace-pre-wrap border-t border-border pt-4 text-sm">{part.description}</p>}
          </Card>

          <Card>
            <h2 className="border-b border-border px-5 py-3 font-medium">{t("stock.byLocation")}</h2>
            <Table>
              <thead>
                <tr>
                  <th>{t("stock.location")}</th>
                  <th className="text-right">{t("stock.quantity")}</th>
                  <th className="text-right">{t("stock.locationMin")}</th>
                </tr>
              </thead>
              <tbody>
                {locations.map((l) => {
                  const row = part.stock.find((s) => s.locationId === l.id);
                  const q = Number(row?.quantity ?? 0);
                  const min = row?.minQuantity != null ? Number(row.minQuantity) : null;
                  return (
                    <tr key={l.id}>
                      <td>
                        <Link href={`/parts?location=${l.id}`} className="hover:text-brand">
                          {l.name}
                        </Link>
                        <div className="text-xs text-muted">
                          {t(`locationType.${l.type}`)}
                          {l.user && ` · ${l.user.name}`}
                        </div>
                      </td>
                      <td className={cn("text-right tabular-nums", q === 0 && "text-muted")}>
                        <span className="inline-flex items-center gap-2">
                          {min != null && min > 0 && q <= min && <LowStockBadge />}
                          {format.number(q)}
                        </span>
                      </td>
                      <td className="text-right tabular-nums text-muted">{min != null ? format.number(min) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            {canManage && locations.length > 0 && (
              <div className="grid gap-3 border-t border-border p-4 sm:grid-cols-3">
                <details className="rounded-md border border-border p-3 [&_summary]:cursor-pointer">
                  <summary className="text-sm font-medium">{t("stock.count")}</summary>
                  <p className="mt-2 text-xs text-muted">{t("stock.countHint")}</p>
                  <ActionForm action={countStockAction.bind(null, part.id)} submitLabel={t("common.save")} successMessage={t("common.saved")} className="mt-3">
                    <Field label={t("stock.location")}>
                      <Select name="locationId">{locationOptions}</Select>
                    </Field>
                    <Field label={t("stock.newQuantity")}>
                      <Input name="quantity" type="number" step="any" min={0} required />
                      <FieldError name="quantity" />
                    </Field>
                    <Input name="note" placeholder={t("stock.notePlaceholder")} />
                  </ActionForm>
                </details>
                <details className="rounded-md border border-border p-3 [&_summary]:cursor-pointer">
                  <summary className="text-sm font-medium">{t("stock.transfer")}</summary>
                  <p className="mt-2 text-xs text-muted">{t("stock.transferHint")}</p>
                  <ActionForm action={transferStockAction.bind(null, part.id)} submitLabel={t("stock.transfer")} successMessage={t("common.saved")} className="mt-3">
                    <Field label={t("stock.from")}>
                      <Select name="fromId">{locationOptions}</Select>
                    </Field>
                    <Field label={t("stock.to")}>
                      <Select name="toId" defaultValue={locations[1]?.id}>
                        {locationOptions}
                      </Select>
                    </Field>
                    <Field label={t("stock.quantity")}>
                      <Input name="quantity" type="number" step="any" min={0} required />
                      <FieldError name="quantity" />
                    </Field>
                    <Input name="note" placeholder={t("stock.notePlaceholder")} />
                  </ActionForm>
                </details>
                <details className="rounded-md border border-border p-3 [&_summary]:cursor-pointer">
                  <summary className="text-sm font-medium">{t("stock.setMin")}</summary>
                  <p className="mt-2 text-xs text-muted">{t("stock.setMinHint")}</p>
                  <ActionForm action={setLocationMinAction.bind(null, part.id)} submitLabel={t("common.save")} successMessage={t("common.saved")} className="mt-3">
                    <Field label={t("stock.location")}>
                      <Select name="locationId">{locationOptions}</Select>
                    </Field>
                    <Field label={t("stock.locationMin")}>
                      <Input name="minQuantity" type="number" step="any" min={0} placeholder={t("stock.minBlank")} />
                      <FieldError name="minQuantity" />
                    </Field>
                  </ActionForm>
                </details>
              </div>
            )}
          </Card>

          <Card>
            <h2 className="border-b border-border px-5 py-3 font-medium">{t("stock.movements")}</h2>
            {movements.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted">{t("stock.noMovements")}</p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>{t("stock.when")}</th>
                    <th>{t("stock.movement")}</th>
                    <th>{t("stock.location")}</th>
                    <th className="text-right">{t("stock.quantity")}</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => {
                    const q = Number(m.quantity);
                    return (
                      <tr key={m.id}>
                        <td className="whitespace-nowrap text-xs text-muted">
                          {dt(m.createdAt)}
                          {m.user && <div>{m.user.name}</div>}
                        </td>
                        <td>
                          {m.type === "CONSUMPTION" && q > 0 ? t("stock.returned") : t(`movementType.${m.type}`)}
                          <div className="text-xs text-muted">
                            {m.workOrder && (
                              <Link href={`/work-orders/${m.workOrder.id}`} className="hover:text-brand">
                                {docRef(m.workOrder)}
                              </Link>
                            )}
                            {m.purchaseOrder && (
                              <Link href={`/purchase-orders/${m.purchaseOrder.id}`} className="hover:text-brand">
                                PO-{m.purchaseOrder.number}
                              </Link>
                            )}
                            {m.note && m.note !== "return" && <span className="ml-1">{m.note}</span>}
                          </div>
                        </td>
                        <td className="text-muted">{m.location.name}</td>
                        <td className={cn("text-right font-medium tabular-nums", q < 0 ? "text-danger" : "text-green-700")}>
                          {q > 0 ? "+" : ""}
                          {format.number(q)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-3 font-medium">{t("parts.photos")}</h2>
            <AttachmentsPanel
              target={{ partId: part.id }}
              canEdit={canManage}
              onDelete={deletePartAttachmentAction.bind(null, part.id)}
              files={part.attachments.map((f) => ({ id: f.id, url: fileUrl(f.id), filename: f.filename, mimeType: f.mimeType }))}
            />
          </Card>

          {openPos.length > 0 && (
            <Card className="p-5">
              <h2 className="mb-3 font-medium">{t("parts.onOrder")}</h2>
              <ul className="space-y-2 text-sm">
                {openPos.map((po) => (
                  <li key={po.id} className="flex items-center justify-between gap-2">
                    <Link href={`/purchase-orders/${po.id}`} className="font-medium hover:text-brand">
                      PO-{po.number}
                    </Link>
                    <span className="flex items-center gap-2">
                      <PoStatusBadge status={po.status} />
                      <span className="tabular-nums">{qty(po.lines.reduce((s, l) => s + remainingQty(l), 0))}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="p-5">
            <h2 className="mb-1 font-medium">{t("parts.compatibleAssets")}</h2>
            <p className="mb-3 text-xs text-muted">{t("parts.compatibleHint")}</p>
            {part.assets.length === 0 ? (
              <p className="text-sm text-muted">—</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {part.assets.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2">
                    <Link href={`/assets/${a.id}`} className="min-w-0 hover:text-brand">
                      <span className="block truncate">{a.name}</span>
                      <span className="block text-xs text-muted">{a.villa.name}</span>
                    </Link>
                    {(canManage || ctx.can("assets.manage")) && <ConfirmIconButton action={unlinkAssetPartAction.bind(null, a.id, part.id)} />}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
