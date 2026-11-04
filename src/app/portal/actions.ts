"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { enumOf, optDate, optId, optStr, parseForm, str, type FormResult } from "@/lib/forms";
import { windowError } from "@/lib/request-window";
import { getPortalContext } from "@/lib/portal";
import { createRequest, MAX_REQUEST_PHOTOS } from "@/lib/requests";
import { Priority } from "@/generated/prisma/enums";

const schema = z.object({
  villaId: str(40),
  areaId: optId(),
  assetId: optId(),
  title: str(200),
  description: optStr(5000),
  priority: enumOf(Priority).default("MEDIUM"),
  availableFrom: optDate(),
  availableTo: optDate(),
});

export async function createPortalRequestAction(_: FormResult, form: FormData): Promise<FormResult> {
  const ctx = await getPortalContext();
  const parsed = parseForm(schema, form); // unknown keys (photos) are stripped
  if (parsed.error) return parsed.error;
  const d = parsed.data;
  const bad = windowError(d);
  if (bad) return { error: "validation", fieldErrors: { [bad.field]: bad.code } };

  // Everything must belong to one of this client's villas.
  const villa = await ctx.db.villa.findFirst({ where: { id: d.villaId, ...ctx.villaWhere } });
  if (!villa) return { error: "validation", fieldErrors: { villaId: "invalid" } };
  const asset = d.assetId ? await ctx.db.asset.findFirst({ where: { id: d.assetId, villaId: villa.id }, select: { id: true, areaId: true, system: true } }) : null;
  const area = d.areaId ? await ctx.db.area.findFirst({ where: { id: d.areaId, villaId: villa.id }, select: { id: true } }) : null;

  const photos = form.getAll("photos").filter((f): f is File => f instanceof File).slice(0, MAX_REQUEST_PHOTOS);
  const req = await createRequest(
    ctx.db,
    ctx.organization.id,
    {
      title: d.title,
      description: d.description,
      priority: d.priority,
      villaId: villa.id,
      areaId: area?.id ?? asset?.areaId ?? null,
      assetId: asset?.id ?? null,
      system: asset?.system ?? null,
      requesterId: ctx.user.id,
      availableFrom: d.availableFrom,
      availableTo: d.availableTo,
    },
    photos,
  );
  revalidatePath("/portal");
  redirect(`/portal/requests/${req.id}`);
}
