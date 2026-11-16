"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/context";
import { assertOwned } from "@/lib/db/tenant";
import { enumOf, optEnumOf, optId, optInt, optNumber, optStr, parseForm, str, type FormResult } from "@/lib/forms";
import { AreaKind, BillTo, ConnectivityType } from "@/generated/prisma/enums";
import { relinkClientWorkOrders } from "@/lib/contracts";
import { normalizeBillTo } from "@/lib/villa-client";
import { isHostOrIp, NO_RESULT } from "@/lib/connectivity-rules";
import { checkVilla } from "@/lib/connectivity";
import { refreshDistances, setManualDistance } from "@/lib/offices";
import type { TenantDb } from "@/lib/db/tenant";

/** The km typed per office on the villa form (`officeKm.<officeId>`; blank = worked out), for the company's offices only. */
async function officeKmFrom(db: TenantDb, form: FormData): Promise<Map<string, number | null> | "invalid"> {
  const offices = await db.office.findMany({ select: { id: true } });
  const out = new Map<string, number | null>();
  for (const { id } of offices) {
    const raw = form.get(`officeKm.${id}`);
    if (raw === null) continue;
    const text = String(raw).trim().replace(",", ".");
    const km = text === "" ? null : Number(text);
    if (km !== null && (!Number.isFinite(km) || km < 0 || km > 10_000)) return "invalid";
    out.set(id, km);
  }
  return out;
}

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
    distanceKm: optNumber().refine((v) => v === null || (v >= 0 && v <= 10_000)),
    defaultOfficeId: optId(),
    accessNotes: optStr(5000),
    connectivityType: optEnumOf(ConnectivityType),
    connectivityHost: optStr(253).refine((v) => v === null || isHostOrIp(v), { message: "invalid_host" }),
    connectivityPort: optInt().refine((v) => v === null || (v >= 1 && v <= 65535)),
    connectivityVpn: optStr(100),
  })
  .refine((v) => v.clientId || v.managerId, { path: ["clientId"], message: "ownerOrManager" })
  .refine((v) => !v.clientId || v.managerId !== v.clientId, { path: ["managerId"], message: "managerIsOwner" })
  .refine((v) => !v.connectivityType || v.connectivityHost, { path: ["connectivityHost"], message: "too_small" })
  // Not monitored: drop the connection details, so a stale host is never probed.
  .transform((v) => ({
    ...v,
    connectivityHost: v.connectivityType ? v.connectivityHost : null,
    connectivityPort: v.connectivityType ? v.connectivityPort : null,
    connectivityVpn: v.connectivityType === "VPN" ? v.connectivityVpn : null,
  }));

export async function saveVillaAction(id: string | null, _: FormResult, form: FormData): Promise<FormResult> {
  const ctx = await requirePermission("clients.manage");
  const parsed = parseForm(villaSchema, form);
  if (parsed.error) return parsed.error;
  const data = { ...parsed.data, billTo: normalizeBillTo(parsed.data) };
  await assertOwned(ctx.db, "client", [data.clientId, data.managerId]);
  await assertOwned(ctx.db, "office", [data.defaultOfficeId]);
  const officeKm = await officeKmFrom(ctx.db, form);
  if (officeKm === "invalid") return { error: "validation", fieldErrors: {} };

  let villaId = id;
  if (id) {
    const before = await ctx.db.villa.findUniqueOrThrow({
      where: { id },
      select: { clientId: true, managerId: true, connectivityType: true, connectivityHost: true, connectivityPort: true },
    });
    // A different host or port: the last check result no longer applies.
    const reachChanged =
      before.connectivityType !== data.connectivityType ||
      before.connectivityHost !== data.connectivityHost ||
      before.connectivityPort !== data.connectivityPort;
    await ctx.db.villa.update({ where: { id }, data: reachChanged ? { ...data, ...NO_RESULT } : data });
    // Owner or manager changed: the villa's jobs may now fall under a different service contract.
    if (before.clientId !== data.clientId || before.managerId !== data.managerId) {
      const affected = new Set([before.clientId, before.managerId, data.clientId, data.managerId].filter((c): c is string => !!c));
      for (const clientId of affected) await relinkClientWorkOrders(ctx.db, clientId);
    }
  } else {
    villaId = (await ctx.db.villa.create({ data: { ...data, organizationId: ctx.organization.id } })).id;
  }
  // Distances typed for each office, then the rest worked out from the coordinates.
  for (const [officeId, km] of officeKm) await setManualDistance(ctx.db, ctx.organization.id, villaId!, officeId, km);
  if (officeKm.size) await refreshDistances(ctx.db, ctx.organization.id, { road: ctx.organization.roadDistances, villaIds: [villaId!] });
  revalidatePath("/villas");
  redirect(`/villas/${villaId}`);
}

export async function setVillaArchivedAction(id: string, archived: boolean) {
  const ctx = await requirePermission("clients.manage");
  await ctx.db.villa.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
  revalidatePath("/villas");
  revalidatePath(`/villas/${id}`);
}

/** "Check now" on the villa page: probes the villa's DynDNS name or VPN address and stores the result. */
export async function checkConnectivityAction(id: string) {
  const ctx = await requirePermission("internal.view");
  const villa = await ctx.db.villa.findUniqueOrThrow({
    where: { id },
    select: { connectivityHost: true, connectivityPort: true, online: true, onlineSince: true },
  });
  const data = await checkVilla(villa);
  if (data) await ctx.db.villa.update({ where: { id }, data });
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
