"use server";

import { NOT_IN_STAFF_LISTS } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/context";
import { assertOwned } from "@/lib/db/tenant";
import { enumOf, optEnumOf, optId, optNumber, optStr, parseForm, str, type FormResult } from "@/lib/forms";
import { deleteObject } from "@/lib/storage";
import {
  createLowStockPurchaseOrders,
  InventoryError,
  restockVan,
  setLocationMin,
  setStockLevel,
  transferStock,
} from "@/lib/inventory";
import { StockLocationType, SystemType } from "@/generated/prisma/enums";

const qty = () => z.coerce.number().finite().min(0).max(1_000_000);
const money = () => z.coerce.number().finite().min(0).max(10_000_000);

/** Runs inventory logic, turning its domain errors into form errors ("stock.<code>" message keys). */
async function guarded(fn: () => Promise<unknown>): Promise<FormResult> {
  try {
    await fn();
    return { ok: true };
  } catch (e) {
    if (e instanceof InventoryError) return { error: `stock.${e.code}` };
    throw e;
  }
}

// ── Parts

const partSchema = z.object({
  name: str(200),
  sku: optStr(100),
  barcode: optStr(100),
  description: optStr(5000),
  system: optEnumOf(SystemType),
  manufacturer: optStr(100),
  model: optStr(100),
  unit: str(20),
  unitCost: money(), // sale price
  purchaseCost: money(),
  minQuantity: qty(),
  vendorId: optId(),
});

export async function savePartAction(id: string | null, _: FormResult, form: FormData): Promise<FormResult> {
  const ctx = await requirePermission("inventory.manage");
  const parsed = parseForm(partSchema, form);
  if (parsed.error) return parsed.error;
  const { data } = parsed;
  await assertOwned(ctx.db, "vendor", [data.vendorId]);

  let partId = id;
  if (id) {
    await ctx.db.part.update({ where: { id }, data });
  } else {
    // Opening stock, if given, goes into the chosen location as an adjustment.
    const opening = z.object({ openingQuantity: optNumber(), openingLocationId: optId() }).safeParse(Object.fromEntries(form));
    const { openingQuantity, openingLocationId } = opening.success ? opening.data : { openingQuantity: null, openingLocationId: null };
    if (openingQuantity != null && (openingQuantity < 0 || openingQuantity > 1_000_000)) {
      return { error: "validation", fieldErrors: { openingQuantity: "invalid" } };
    }
    await assertOwned(ctx.db, "stockLocation", [openingLocationId]);
    const created = await ctx.db.part.create({ data: { ...data, organizationId: ctx.organization.id } });
    partId = created.id;
    if (openingQuantity && openingLocationId) await setStockLevel(ctx, partId, openingLocationId, openingQuantity, null);
  }
  revalidatePath("/parts");
  redirect(`/parts/${partId}`);
}

export async function setPartArchivedAction(id: string, archived: boolean) {
  const ctx = await requirePermission("inventory.manage");
  await ctx.db.part.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
  revalidatePath("/parts");
  revalidatePath(`/parts/${id}`);
}

// ── Stock

const countSchema = z.object({ locationId: str(40), quantity: qty(), note: optStr(500) });

export async function countStockAction(partId: string, _: FormResult, form: FormData): Promise<FormResult> {
  const ctx = await requirePermission("inventory.manage");
  const parsed = parseForm(countSchema, form);
  if (parsed.error) return parsed.error;
  const { locationId, quantity, note } = parsed.data;
  const res = await guarded(() => setStockLevel(ctx, partId, locationId, quantity, note));
  revalidatePath(`/parts/${partId}`);
  return res;
}

const transferSchema = z.object({
  fromId: str(40),
  toId: str(40),
  quantity: z.coerce.number().finite().positive().max(1_000_000),
  note: optStr(500),
});

export async function transferStockAction(partId: string, _: FormResult, form: FormData): Promise<FormResult> {
  const ctx = await requirePermission("inventory.manage");
  const parsed = parseForm(transferSchema, form);
  if (parsed.error) return parsed.error;
  const { fromId, toId, quantity, note } = parsed.data;
  const res = await guarded(() => transferStock(ctx, partId, fromId, toId, quantity, note));
  revalidatePath(`/parts/${partId}`);
  return res;
}

const minSchema = z.object({ locationId: str(40), minQuantity: optNumber().refine((v) => v === null || (v >= 0 && v <= 1_000_000)) });

export async function setLocationMinAction(partId: string, _: FormResult, form: FormData): Promise<FormResult> {
  const ctx = await requirePermission("inventory.manage");
  const parsed = parseForm(minSchema, form);
  if (parsed.error) return parsed.error;
  const res = await guarded(() => setLocationMin(ctx, partId, parsed.data.locationId, parsed.data.minQuantity));
  revalidatePath(`/parts/${partId}`);
  return res;
}

// ── Compatible assets (M2M, managed from the asset page)

export async function linkAssetPartAction(assetId: string, _: FormResult, form: FormData): Promise<FormResult> {
  const ctx = await requireLinkPermission();
  const partId = z.string().min(1).max(40).safeParse(form.get("partId"));
  if (!partId.success) return { error: "validation", fieldErrors: { partId: "too_small" } };
  await assertOwned(ctx.db, "asset", [assetId]);
  await assertOwned(ctx.db, "part", [partId.data]);
  await ctx.db.asset.update({ where: { id: assetId }, data: { parts: { connect: { id: partId.data } } } });
  revalidatePath(`/assets/${assetId}`);
  revalidatePath(`/parts/${partId.data}`);
  return { ok: true };
}

export async function unlinkAssetPartAction(assetId: string, partId: string) {
  const ctx = await requireLinkPermission();
  await assertOwned(ctx.db, "part", [partId]);
  await ctx.db.asset.update({ where: { id: assetId }, data: { parts: { disconnect: { id: partId } } } });
  revalidatePath(`/assets/${assetId}`);
  revalidatePath(`/parts/${partId}`);
}

async function requireLinkPermission() {
  const ctx = await requirePermission("internal.view");
  if (!ctx.can("inventory.manage") && !ctx.can("assets.manage")) throw new Error("Forbidden");
  return ctx;
}

// ── Photos

export async function deletePartAttachmentAction(partId: string, attachmentId: string) {
  const ctx = await requirePermission("inventory.manage");
  const att = await ctx.db.attachment.findFirst({ where: { id: attachmentId, partId } });
  if (!att) return;
  await ctx.db.attachment.delete({ where: { id: att.id } });
  await deleteObject(att.url);
  revalidatePath(`/parts/${partId}`);
}

// ── Reordering

export async function reorderLowStockAction(): Promise<{ created: number; skipped: number }> {
  const ctx = await requirePermission("purchasing.manage");
  const { created, skipped } = await createLowStockPurchaseOrders(ctx);
  revalidatePath("/purchase-orders");
  if (created.length === 1 && skipped === 0) redirect(`/purchase-orders/${created[0]}`);
  return { created: created.length, skipped };
}

// ── Stock locations

const locationSchema = z.object({
  name: str(100),
  type: enumOf(StockLocationType),
  userId: optId(),
});

export async function saveLocationAction(id: string | null, _: FormResult, form: FormData): Promise<FormResult> {
  const ctx = await requirePermission("inventory.manage");
  const parsed = parseForm(locationSchema, form);
  if (parsed.error) return parsed.error;
  const data = { ...parsed.data, userId: parsed.data.type === "VAN" ? parsed.data.userId : null };
  if (data.userId) {
    const member = await ctx.db.membership.count({ where: { userId: data.userId, active: true, role: { notIn: NOT_IN_STAFF_LISTS } } });
    if (!member) return { error: "validation", fieldErrors: { userId: "invalid" } };
  }
  if (id) await ctx.db.stockLocation.update({ where: { id }, data });
  else await ctx.db.stockLocation.create({ data: { ...data, organizationId: ctx.organization.id } });
  revalidatePath("/parts/locations");
  return { ok: true };
}

export async function setLocationArchivedAction(id: string, archived: boolean) {
  const ctx = await requirePermission("inventory.manage");
  await ctx.db.stockLocation.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
  revalidatePath("/parts/locations");
}

// ── Van restock (technicians, for their own van)

export type RestockResult = { ok?: boolean; error?: string; detail?: string; moved?: number } | undefined;

const restockSchema = z.object({
  vanId: z.string().min(1).max(40),
  warehouseId: z.string().min(1).max(40),
  direction: z.enum(["load", "unload"]),
  note: z.string().max(500).optional(),
  lines: z.array(z.object({ partId: z.string().min(1).max(40), quantity: z.number().finite().positive().max(1_000_000) })).max(200),
});

/** Loads parts from a warehouse into the van, or puts them back; all lines or none. */
export async function restockVanAction(_: RestockResult, form: FormData): Promise<RestockResult> {
  const ctx = await requirePermission("inventory.use");
  let lines: unknown;
  try {
    lines = JSON.parse(String(form.get("lines") ?? "[]"));
  } catch {
    return { error: "stock.noLines" };
  }
  const parsed = restockSchema.safeParse({
    vanId: form.get("vanId"),
    warehouseId: form.get("warehouseId"),
    direction: form.get("direction"),
    note: String(form.get("note") ?? "").trim() || undefined,
    lines,
  });
  if (!parsed.success) return { error: "stock.noLines" };
  try {
    const { moved } = await restockVan(ctx, { ...parsed.data, anyVan: ctx.can("inventory.manage") });
    revalidatePath("/parts", "layout");
    return { ok: true, moved };
  } catch (e) {
    if (e instanceof InventoryError) return { error: `stock.${e.code}`, detail: e.detail };
    throw e;
  }
}
