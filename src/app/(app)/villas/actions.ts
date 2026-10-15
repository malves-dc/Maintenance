"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/context";
import { assertOwned } from "@/lib/db/tenant";
import { enumOf, optId, optNumber, optStr, parseForm, str, type FormResult } from "@/lib/forms";
import { AreaKind, BillTo } from "@/generated/prisma/enums";
import { relinkClientWorkOrders } from "@/lib/contracts";
import { normalizeBillTo } from "@/lib/villa-client";

const villaSchema = z
  .object({
    clientId: optId(),
    managerId: optId(),
    billTo: enumOf(BillTo).catch("OWNER"),
    name: str(150),
    code: optStr(30),
    address: optStr(300),
    city: optStr(100),
    country: optStr(100),
    latitude: optNumber().refine((v) => v === null || Math.abs(v) <= 90),
    longitude: optNumber().refine((v) => v === null || Math.abs(v) <= 180),
    accessNotes: optStr(5000),
  })
  .refine((v) => v.clientId || v.managerId, { path: ["clientId"], message: "ownerOrManager" })
  .refine((v) => !v.clientId || v.managerId !== v.clientId, { path: ["managerId"], message: "managerIsOwner" });

export async function saveVillaAction(id: string | null, _: FormResult, form: FormData): Promise<FormResult> {
  const ctx = await requirePermission("clients.manage");
  const parsed = parseForm(villaSchema, form);
  if (parsed.error) return parsed.error;
  const data = { ...parsed.data, billTo: normalizeBillTo(parsed.data) };
  await assertOwned(ctx.db, "client", [data.clientId, data.managerId]);

  let villaId = id;
  if (id) {
    const before = await ctx.db.villa.findUniqueOrThrow({ where: { id }, select: { clientId: true, managerId: true } });
    await ctx.db.villa.update({ where: { id }, data });
    // Owner or manager changed: the villa's jobs may now fall under a different service contract.
    if (before.clientId !== data.clientId || before.managerId !== data.managerId) {
      const affected = new Set([before.clientId, before.managerId, data.clientId, data.managerId].filter((c): c is string => !!c));
      for (const clientId of affected) await relinkClientWorkOrders(ctx.db, clientId);
    }
  } else {
    villaId = (await ctx.db.villa.create({ data: { ...data, organizationId: ctx.organization.id } })).id;
  }
  revalidatePath("/villas");
  redirect(`/villas/${villaId}`);
}

export async function setVillaArchivedAction(id: string, archived: boolean) {
  const ctx = await requirePermission("clients.manage");
  await ctx.db.villa.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
  revalidatePath("/villas");
  revalidatePath(`/villas/${id}`);
}

// ── Areas (floors / rooms / zones)

const areaSchema = z.object({
  name: str(100),
  kind: enumOf(AreaKind),
  parentId: optId(),
});

export async function addAreaAction(villaId: string, _: FormResult, form: FormData): Promise<FormResult> {
  const ctx = await requirePermission("assets.manage");
  await assertOwned(ctx.db, "villa", [villaId]);
  const parsed = parseForm(areaSchema, form);
  if (parsed.error) return parsed.error;
  const { data } = parsed;
  if (data.parentId) {
    const parent = await ctx.db.area.findFirst({ where: { id: data.parentId, villaId } });
    if (!parent) return { error: "somethingWrong" };
  }
  await ctx.db.area.create({ data: { ...data, villaId, organizationId: ctx.organization.id } });
  revalidatePath(`/villas/${villaId}`);
  return { ok: true };
}

export async function renameAreaAction(areaId: string, name: string) {
  const ctx = await requirePermission("assets.manage");
  const clean = z.string().trim().min(1).max(100).parse(name);
  const area = await ctx.db.area.update({ where: { id: areaId }, data: { name: clean } });
  revalidatePath(`/villas/${area.villaId}`);
}

export async function deleteAreaAction(areaId: string) {
  const ctx = await requirePermission("assets.manage");
  const area = await ctx.db.area.delete({ where: { id: areaId } });
  revalidatePath(`/villas/${area.villaId}`);
}
