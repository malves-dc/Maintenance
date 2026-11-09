import "server-only";
import type { StockMovementType } from "@/generated/prisma/enums";
import { nextNumber, type TenantDb } from "@/lib/db/tenant";
import type { WoCtx } from "@/lib/work-orders";
import { membersWith, notify } from "@/lib/notify";
import { audit } from "@/lib/audit";
import { isLowStock, onHand, PO_OPEN_STATUSES, PO_RECEIVABLE, remainingQty, reorderQuantity, roundQty, statusAfterReceipt } from "@/lib/inventory-math";

export class InventoryError extends Error {
  constructor(
    public code: "insufficientStock" | "invalidRef" | "invalidQuantity" | "sameLocation" | "notEditable" | "overReceive" | "noLines" | "notYourVan" | "tooManySerials",
    /** e.g. the part that ran short */
    public detail?: string,
  ) {
    super(code);
  }
}

type Tx = Parameters<Parameters<TenantDb["$transaction"]>[0]>[0];

type Move = {
  partId: string;
  locationId: string;
  delta: number; // signed
  type: StockMovementType;
  unitCost?: number | null;
  workOrderId?: string | null;
  purchaseOrderId?: string | null;
  note?: string | null;
};

/**
 * Applies one signed stock change and logs it. Decrements are conditional on enough stock
 * (a single guarded UPDATE, so two technicians can't both take the last unit).
 * Callers validate part/location ownership first; PartStock has no organizationId of its own.
 */
async function move(tx: Tx, ctx: WoCtx, m: Move) {
  const delta = roundQty(m.delta);
  if (delta === 0) return;
  if (delta < 0) {
    const r = await tx.partStock.updateMany({
      where: { partId: m.partId, locationId: m.locationId, quantity: { gte: -delta } },
      data: { quantity: { increment: delta } },
    });
    if (r.count === 0) throw new InventoryError("insufficientStock");
  } else {
    await tx.partStock.upsert({
      where: { partId_locationId: { partId: m.partId, locationId: m.locationId } },
      create: { partId: m.partId, locationId: m.locationId, quantity: delta },
      update: { quantity: { increment: delta } },
    });
  }
  await tx.stockMovement.create({
    data: {
      organizationId: ctx.organization.id,
      partId: m.partId,
      locationId: m.locationId,
      type: m.type,
      quantity: delta,
      unitCost: m.unitCost ?? null,
      workOrderId: m.workOrderId ?? null,
      purchaseOrderId: m.purchaseOrderId ?? null,
      userId: ctx.user.id,
      note: m.note ?? null,
    },
  });
}

async function activePart(ctx: WoCtx, partId: string) {
  const part = await ctx.db.part.findFirst({ where: { id: partId, archivedAt: null } });
  if (!part) throw new InventoryError("invalidRef");
  return part;
}

async function activeLocation(ctx: WoCtx, locationId: string) {
  const loc = await ctx.db.stockLocation.findFirst({ where: { id: locationId, archivedAt: null } });
  if (!loc) throw new InventoryError("invalidRef");
  return loc;
}

function positive(q: number) {
  if (!Number.isFinite(q) || roundQty(q) <= 0) throw new InventoryError("invalidQuantity");
  return roundQty(q);
}

/** Stock count: sets the quantity at a location, logging the difference as an adjustment. */
export async function setStockLevel(ctx: WoCtx, partId: string, locationId: string, quantity: number, note?: string | null) {
  if (!Number.isFinite(quantity) || quantity < 0) throw new InventoryError("invalidQuantity");
  await activePart(ctx, partId);
  await activeLocation(ctx, locationId);
  await watchLowStock(ctx, partId, () => ctx.db.$transaction(async (tx) => {
    const row = await tx.partStock.findUnique({ where: { partId_locationId: { partId, locationId } } });
    const delta = roundQty(quantity - Number(row?.quantity ?? 0));
    await move(tx, ctx, { partId, locationId, delta, type: "ADJUSTMENT", note });
  }));
}

export async function transferStock(ctx: WoCtx, partId: string, fromId: string, toId: string, quantity: number, note?: string | null) {
  const q = positive(quantity);
  if (fromId === toId) throw new InventoryError("sameLocation");
  await activePart(ctx, partId);
  await activeLocation(ctx, fromId);
  await activeLocation(ctx, toId);
  await watchLowStock(ctx, partId, () => ctx.db.$transaction(async (tx) => {
    await move(tx, ctx, { partId, locationId: fromId, delta: -q, type: "TRANSFER_OUT", note });
    await move(tx, ctx, { partId, locationId: toId, delta: q, type: "TRANSFER_IN", note });
  }));
}

export type RestockLine = { partId: string; quantity: number };

/**
 * A technician loading parts from a warehouse into their own van ("load"), or taking them back ("unload").
 * Every line moves or none does (the first part short of stock is named in the error). Anyone who manages
 * inventory may do it for any van. Logged as stock movements and in the audit log.
 */
export async function restockVan(
  ctx: WoCtx,
  opts: { vanId: string; warehouseId: string; direction: "load" | "unload"; lines: RestockLine[]; note?: string | null; anyVan: boolean },
) {
  const van = await activeLocation(ctx, opts.vanId);
  const warehouse = await activeLocation(ctx, opts.warehouseId);
  if (van.type !== "VAN" || warehouse.type !== "WAREHOUSE") throw new InventoryError("invalidRef");
  if (!opts.anyVan && van.userId !== ctx.user.id) throw new InventoryError("notYourVan");

  const qty = new Map<string, number>();
  for (const l of opts.lines) qty.set(l.partId, roundQty((qty.get(l.partId) ?? 0) + positive(l.quantity)));
  if (qty.size === 0) throw new InventoryError("noLines");
  const parts = await ctx.db.part.findMany({ where: { id: { in: [...qty.keys()] }, archivedAt: null }, select: { id: true, name: true, unit: true } });
  if (parts.length !== qty.size) throw new InventoryError("invalidRef");

  const [fromId, toId] = opts.direction === "load" ? [warehouse.id, van.id] : [van.id, warehouse.id];
  const before = await Promise.all(parts.map((p) => stockState(ctx, p.id)));
  await ctx.db.$transaction(async (tx) => {
    for (const p of parts) {
      const q = qty.get(p.id)!;
      try {
        await move(tx, ctx, { partId: p.id, locationId: fromId, delta: -q, type: "TRANSFER_OUT", note: opts.note });
      } catch (e) {
        if (e instanceof InventoryError && e.code === "insufficientStock") throw new InventoryError("insufficientStock", p.name);
        throw e;
      }
      await move(tx, ctx, { partId: p.id, locationId: toId, delta: q, type: "TRANSFER_IN", note: opts.note });
    }
  });
  // Loading a van can tip the warehouse under its reorder point.
  for (const [i, p] of parts.entries()) {
    const after = await stockState(ctx, p.id);
    const was = before[i];
    if (!was || !after || isLowStock(was) || !isLowStock(after)) continue;
    await notify(ctx, await membersWith(ctx.db, "inventory.manage"), {
      type: "LOW_STOCK",
      data: { part: after.name, qty: onHand(after.stock), unit: after.unit },
      link: `/parts/${after.id}`,
    });
  }
  await audit(ctx, "stock.vanRestock", "StockLocation", van.id, {
    label: van.name,
    direction: opts.direction,
    warehouse: warehouse.name,
    parts: parts.map((p) => `${qty.get(p.id)} ${p.unit} × ${p.name}`).join("; "),
    ...(opts.note ? { note: opts.note } : {}),
  });
  return { moved: parts.length };
}

/** Per-location reorder point (null clears the override). */
export async function setLocationMin(ctx: WoCtx, partId: string, locationId: string, min: number | null) {
  if (min != null && (!Number.isFinite(min) || min < 0)) throw new InventoryError("invalidQuantity");
  await activePart(ctx, partId);
  await activeLocation(ctx, locationId);
  await ctx.db.partStock.upsert({
    where: { partId_locationId: { partId, locationId } },
    create: { partId, locationId, quantity: 0, minQuantity: min },
    update: { minQuantity: min },
  });
}

// ── Low-stock alerts

async function stockState(ctx: WoCtx, partId: string) {
  return ctx.db.part.findUnique({
    where: { id: partId },
    select: { id: true, name: true, unit: true, minQuantity: true, stock: { where: { location: { archivedAt: null } }, select: { quantity: true, minQuantity: true } } },
  });
}

/** Runs a stock change and sends LOW_STOCK when it tips the part below a reorder point (once, not on every take). */
async function watchLowStock(ctx: WoCtx, partId: string, change: () => Promise<unknown>) {
  const before = await stockState(ctx, partId);
  await change();
  const after = await stockState(ctx, partId);
  if (!before || !after || isLowStock(before) || !isLowStock(after)) return;
  await notify(ctx, await membersWith(ctx.db, "inventory.manage"), {
    type: "LOW_STOCK",
    data: { part: after.name, qty: onHand(after.stock), unit: after.unit },
    link: `/parts/${after.id}`,
  });
}

// ── Work orders

/** Serial numbers as entered: trimmed, without blanks or repeats; at most one per unit used. */
export function cleanSerials(serials: string[], quantity: number) {
  const out = [...new Set(serials.map((s) => s.trim().slice(0, 80)).filter(Boolean))];
  if (out.length > Math.ceil(quantity)) throw new InventoryError("tooManySerials");
  return out;
}

/** Takes parts out of a location for a work order, at the part's current unit cost (with the units' serial numbers). */
export async function consumePart(ctx: WoCtx, workOrderId: string, partId: string, locationId: string, quantity: number, serials: string[] = []) {
  const q = positive(quantity);
  const serialNumbers = cleanSerials(serials, q);
  const wo = await ctx.db.workOrder.findUnique({ where: { id: workOrderId }, select: { id: true } });
  if (!wo) throw new InventoryError("invalidRef");
  const part = await activePart(ctx, partId);
  await activeLocation(ctx, locationId);
  await watchLowStock(ctx, partId, () => ctx.db.$transaction(async (tx) => {
    await move(tx, ctx, { partId, locationId, delta: -q, type: "CONSUMPTION", unitCost: Number(part.unitCost), workOrderId });
    await tx.workOrderPart.create({ data: { workOrderId, partId, stockLocationId: locationId, quantity: q, unitCost: part.unitCost, serialNumbers } });
  }));
}

/** Undoes a consumption: the quantity goes back to the location it came from. */
export async function returnPart(ctx: WoCtx, workOrderId: string, workOrderPartId: string) {
  const wo = await ctx.db.workOrder.findUnique({ where: { id: workOrderId }, select: { id: true } });
  if (!wo) throw new InventoryError("invalidRef");
  const row = await ctx.db.workOrderPart.findFirst({ where: { id: workOrderPartId, workOrderId } });
  if (!row) throw new InventoryError("invalidRef");
  await ctx.db.$transaction(async (tx) => {
    // The location may have been deleted since (archived ones still take the stock back). Parts typed by hand have no stock.
    if (row.partId && row.stockLocationId) {
      await move(tx, ctx, {
        partId: row.partId,
        locationId: row.stockLocationId,
        delta: Number(row.quantity),
        type: "CONSUMPTION",
        unitCost: Number(row.unitCost),
        workOrderId,
        note: "return",
      });
    }
    await tx.workOrderPart.delete({ where: { id: row.id } });
  });
}

// ── Purchasing

/**
 * Books received quantities against PO lines: part lines add stock at `locationId` (RECEIPT
 * movements) and refresh the part's unit cost to the price paid; then the PO status follows.
 */
export async function receivePurchaseOrder(ctx: WoCtx, poId: string, receipts: { lineId: string; quantity: number }[], locationId: string | null) {
  const po = await ctx.db.purchaseOrder.findUnique({ where: { id: poId }, include: { lines: true } });
  if (!po) throw new InventoryError("invalidRef");
  if (!PO_RECEIVABLE.includes(po.status)) throw new InventoryError("notEditable");
  const wanted = receipts.filter((r) => r.quantity > 0);
  if (wanted.length === 0) throw new InventoryError("invalidQuantity");

  const byId = new Map(po.lines.map((l) => [l.id, l]));
  for (const r of wanted) {
    const line = byId.get(r.lineId);
    if (!line) throw new InventoryError("invalidRef");
    if (roundQty(r.quantity) > remainingQty(line)) throw new InventoryError("overReceive");
  }
  const needsLocation = wanted.some((r) => byId.get(r.lineId)!.partId);
  if (needsLocation) {
    if (!locationId) throw new InventoryError("invalidRef");
    await activeLocation(ctx, locationId);
  }

  await ctx.db.$transaction(async (tx) => {
    for (const r of wanted) {
      const line = byId.get(r.lineId)!;
      const q = roundQty(r.quantity);
      await tx.purchaseOrderLine.update({ where: { id: line.id }, data: { receivedQuantity: { increment: q } } });
      line.receivedQuantity = line.receivedQuantity.add(q);
      if (line.partId && locationId) {
        await move(tx, ctx, { partId: line.partId, locationId, delta: q, type: "RECEIPT", unitCost: Number(line.unitCost), purchaseOrderId: po.id });
        // The vendor's price becomes the part's purchase cost; its sale price (what work orders charge) is left alone.
        await tx.part.update({ where: { id: line.partId, organizationId: ctx.organization.id }, data: { purchaseCost: line.unitCost } });
      }
    }
    await tx.purchaseOrder.update({
      where: { id: po.id, organizationId: ctx.organization.id },
      data: { status: statusAfterReceipt(po.lines) },
    });
  });
}

/** Quantity still to arrive per part, over open purchase orders. */
export async function onOrderByPart(db: TenantDb, partIds?: string[]) {
  const pos = await db.purchaseOrder.findMany({
    where: { status: { in: PO_OPEN_STATUSES } },
    select: { lines: { where: { partId: partIds ? { in: partIds } : { not: null } }, select: { partId: true, quantity: true, receivedQuantity: true } } },
  });
  const map = new Map<string, number>();
  for (const l of pos.flatMap((p) => p.lines)) map.set(l.partId!, roundQty((map.get(l.partId!) ?? 0) + remainingQty(l)));
  return map;
}

/** Active parts at or below a reorder point, with their stock rows. */
export async function lowStockParts(db: TenantDb) {
  const parts = await db.part.findMany({
    where: { archivedAt: null },
    select: {
      id: true,
      name: true,
      unitCost: true,
      purchaseCost: true,
      minQuantity: true,
      vendorId: true,
      stock: { where: { location: { archivedAt: null } }, select: { quantity: true, minQuantity: true } },
    },
  });
  return parts.filter(isLowStock);
}

async function mainWarehouseId(db: TenantDb) {
  const loc = await db.stockLocation.findFirst({ where: { archivedAt: null, type: "WAREHOUSE" }, orderBy: { name: "asc" }, select: { id: true } });
  return loc?.id ?? null;
}

/** Suggested lines (part, quantity, cost) for low-stock parts, net of what is already on order. */
async function reorderLines(db: TenantDb, filter: (p: { vendorId: string | null }) => boolean) {
  const low = (await lowStockParts(db)).filter(filter);
  const onOrder = await onOrderByPart(db, low.map((p) => p.id));
  return low
    .map((p) => ({ part: p, quantity: reorderQuantity(p, onOrder.get(p.id) ?? 0) }))
    .filter((x) => x.quantity > 0);
}

/**
 * One draft PO per preferred vendor for everything low on stock, shipped to the main warehouse.
 * Parts without a preferred vendor are counted in `skipped`.
 */
export async function createLowStockPurchaseOrders(ctx: WoCtx) {
  const lines = await reorderLines(ctx.db, () => true);
  const skipped = lines.filter((l) => !l.part.vendorId).length;
  const byVendor = new Map<string, typeof lines>();
  for (const l of lines) if (l.part.vendorId) byVendor.set(l.part.vendorId, [...(byVendor.get(l.part.vendorId) ?? []), l]);

  const shipToLocationId = await mainWarehouseId(ctx.db);
  const created: string[] = [];
  for (const [vendorId, vLines] of byVendor) {
    const number = await nextNumber(ctx.organization.id, "purchaseOrder");
    const po = await ctx.db.purchaseOrder.create({
      data: {
        organizationId: ctx.organization.id,
        number,
        vendorId,
        shipToLocationId,
        createdById: ctx.user.id,
        lines: {
          create: vLines.map((l) => ({ partId: l.part.id, description: l.part.name, quantity: l.quantity, unitCost: l.part.purchaseCost })),
        },
      },
    });
    created.push(po.id);
  }
  return { created, skipped };
}

/** Adds this vendor's low-stock parts to a draft PO (parts already on it are left alone). */
export async function addLowStockLines(ctx: WoCtx, poId: string) {
  const po = await ctx.db.purchaseOrder.findUnique({ where: { id: poId }, include: { lines: { select: { partId: true } } } });
  if (!po) throw new InventoryError("invalidRef");
  if (po.status !== "DRAFT") throw new InventoryError("notEditable");
  const present = new Set(po.lines.map((l) => l.partId));
  const lines = (await reorderLines(ctx.db, (p) => p.vendorId === po.vendorId)).filter((l) => !present.has(l.part.id));
  if (lines.length === 0) throw new InventoryError("noLines");
  await ctx.db.purchaseOrderLine.createMany({
    data: lines.map((l) => ({ purchaseOrderId: po.id, partId: l.part.id, description: l.part.name, quantity: l.quantity, unitCost: l.part.purchaseCost })),
  });
  return lines.length;
}
