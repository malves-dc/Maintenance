"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/context";
import { prisma } from "@/lib/db/client";
import { assertOwned } from "@/lib/db/tenant";
import { optNumber, optStr, parseForm, str, type FormResult } from "@/lib/forms";
import { audit } from "@/lib/audit";
import { adoptFirstOffice, refreshDistances, type RefreshResult } from "@/lib/offices";

// Settings → Offices (org.manage): the company's offices, who works from each, and how villa distances are worked out.

const PATH = "/settings/offices";

const officeSchema = z
  .object({
    name: str(100),
    address: optStr(300),
    latitude: optNumber().refine((v) => v === null || Math.abs(v) <= 90),
    longitude: optNumber().refine((v) => v === null || Math.abs(v) <= 180),
  })
  .refine((v) => (v.latitude === null) === (v.longitude === null), { path: ["longitude"], message: "bothCoordinates" });

const revalidate = () => {
  revalidatePath(PATH);
  revalidatePath("/villas", "layout");
};

export async function saveOfficeAction(id: string | null, _: FormResult, form: FormData): Promise<FormResult> {
  const ctx = await requirePermission("org.manage");
  const parsed = parseForm(officeSchema, form);
  if (parsed.error) return parsed.error;
  const data = parsed.data;
  const clash = await ctx.db.office.findFirst({ where: { name: { equals: data.name, mode: "insensitive" }, ...(id ? { id: { not: id } } : {}) }, select: { id: true } });
  if (clash) return { error: "validation", fieldErrors: { name: "officeNameTaken" } };

  let officeId = id;
  let moved = true;
  if (id) {
    const before = await ctx.db.office.findUniqueOrThrow({ where: { id }, select: { latitude: true, longitude: true } });
    moved = before.latitude !== data.latitude || before.longitude !== data.longitude;
    await ctx.db.office.update({ where: { id }, data });
  } else {
    const first = (await ctx.db.office.count()) === 0;
    officeId = (await ctx.db.office.create({ data: { ...data, organizationId: ctx.organization.id } })).id;
    if (first) await adoptFirstOffice(ctx.db, ctx.organization.id, officeId);
  }
  // New coordinates: work out this office's distances to every villa again (those typed by hand stay).
  if (moved) await refreshDistances(ctx.db, ctx.organization.id, { road: ctx.organization.roadDistances, officeIds: [officeId!] });
  revalidate();
  return { ok: true };
}

/** Deleting an office: its villas lose their default office, its people their membership, its distances go. */
export async function deleteOfficeAction(id: string) {
  const ctx = await requirePermission("org.manage");
  await ctx.db.office.delete({ where: { id } });
  revalidate();
}

async function assertStaff(ctx: Awaited<ReturnType<typeof requirePermission>>, userId: string) {
  const m = await ctx.db.membership.findFirst({ where: { userId, role: { not: "REQUESTER" } }, select: { id: true } });
  if (!m) throw new Error("Invalid user");
}

export async function addOfficeMemberAction(officeId: string, userId: string) {
  const ctx = await requirePermission("org.manage");
  await assertOwned(ctx.db, "office", [officeId]);
  await assertStaff(ctx, userId);
  const already = await ctx.db.officeMember.count({ where: { userId } });
  await ctx.db.officeMember.upsert({
    where: { officeId_userId: { officeId, userId } },
    create: { organizationId: ctx.organization.id, officeId, userId, primary: already === 0 },
    update: {},
  });
  revalidate();
}

export async function removeOfficeMemberAction(officeId: string, userId: string) {
  const ctx = await requirePermission("org.manage");
  await assertOwned(ctx.db, "office", [officeId]);
  const removed = await ctx.db.officeMember.findUnique({ where: { officeId_userId: { officeId, userId } }, select: { primary: true } });
  await ctx.db.officeMember.deleteMany({ where: { officeId, userId } });
  // Their primary office went: the next one (by name) becomes primary.
  if (removed?.primary) {
    const next = await ctx.db.officeMember.findFirst({ where: { userId }, orderBy: { office: { name: "asc" } }, select: { officeId: true } });
    if (next) await ctx.db.officeMember.update({ where: { officeId_userId: { officeId: next.officeId, userId } }, data: { primary: true } });
  }
  revalidate();
}

/** The office someone's trips leave from by default, when they work from several. */
export async function setPrimaryOfficeAction(officeId: string, userId: string) {
  const ctx = await requirePermission("org.manage");
  await assertOwned(ctx.db, "office", [officeId]);
  const member = await ctx.db.officeMember.findUnique({ where: { officeId_userId: { officeId, userId } }, select: { userId: true } });
  if (!member) throw new Error("Not a member");
  await ctx.db.officeMember.updateMany({ where: { userId, officeId: { not: officeId } }, data: { primary: false } });
  await ctx.db.officeMember.update({ where: { officeId_userId: { officeId, userId } }, data: { primary: true } });
  revalidate();
}

/** Road distances (OSRM) on or off; either way every worked-out distance is redone. */
export async function setRoadDistancesAction(on: boolean): Promise<RefreshResult> {
  const ctx = await requirePermission("org.manage");
  // Organization isn't a tenant-scoped model; scope by id explicitly.
  await prisma.organization.update({ where: { id: ctx.organization.id }, data: { roadDistances: on } });
  await audit(ctx, "organization.update", "Organization", ctx.organization.id, { changes: { roadDistances: [ctx.organization.roadDistances, on] } });
  const result = await refreshDistances(ctx.db, ctx.organization.id, { road: on });
  revalidate();
  return result;
}

/** "Recalculate": redoes every distance not typed by hand (e.g. after villas got coordinates). */
export async function refreshAllDistancesAction(): Promise<RefreshResult> {
  const ctx = await requirePermission("org.manage");
  const result = await refreshDistances(ctx.db, ctx.organization.id, { road: ctx.organization.roadDistances });
  revalidate();
  return result;
}
