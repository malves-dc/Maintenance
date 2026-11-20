"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { enumOf, optDate, optId, optStr, parseForm, str, type FormResult } from "@/lib/forms";
import { windowError } from "@/lib/request-window";
import { getPortalContext } from "@/lib/portal";
import { createRequest, MAX_REQUEST_PHOTOS, storeRequestPhotos } from "@/lib/requests";
import { REQUEST_DESCRIPTION_MAX, REQUEST_PHOTOS_TOTAL, REQUEST_TITLE_MAX } from "@/lib/request-limits";
import { membersWith, notify } from "@/lib/notify";
import { docRef } from "@/lib/series";
import { Priority } from "@/generated/prisma/enums";

const schema = z.object({
  villaId: str(40),
  areaId: optId(),
  assetId: optId(),
  title: str(REQUEST_TITLE_MAX),
  description: optStr(REQUEST_DESCRIPTION_MAX),
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

/**
 * Adds photos to one of the client's requests at any stage, also once it is approved, done or declined
 * (e.g. the problem came back). They are the request's, like the photos sent with it, so they don't change a
 * finished job's service report. Whoever handles requests and the job's technicians are told.
 */
export async function addRequestPhotosAction(requestId: string, _: FormResult, form: FormData): Promise<FormResult> {
  const ctx = await getPortalContext();
  const r = await ctx.db.request.findFirst({
    where: { id: requestId, ...ctx.requestWhere },
    select: { id: true, year: true, number: true, title: true, _count: { select: { attachments: true } }, workOrder: { select: { assignees: { select: { userId: true } } } } },
  });
  if (!r) return { error: "somethingWrong" };
  const room = REQUEST_PHOTOS_TOTAL - r._count.attachments;
  if (room <= 0) return { error: "portal.photosFull" };
  const photos = form.getAll("photos").filter((f): f is File => f instanceof File).slice(0, Math.min(room, MAX_REQUEST_PHOTOS));
  const count = await storeRequestPhotos(ctx.db, ctx.organization.id, r.id, ctx.user.id, photos);
  if (!count) return { error: "portal.photosInvalid" };

  const handlers = await membersWith(ctx.db, "requests.approve", { excludeRoles: ["REQUESTER"] });
  const technicians = r.workOrder?.assignees.map((a) => a.userId) ?? [];
  await notify(ctx, [...new Set([...handlers, ...technicians])], {
    type: "REQUEST_PHOTOS",
    data: { number: docRef(r), title: r.title, actor: ctx.user.name, count },
    link: `/requests/${r.id}`,
  });
  revalidatePath(`/portal/requests/${r.id}`);
  revalidatePath(`/requests/${r.id}`);
  return { ok: true };
}
