"use server";

import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { tenantDb } from "@/lib/db/tenant";
import { enumOf, optDate, optStr, parseForm, str, type FormResult } from "@/lib/forms";
import { windowError } from "@/lib/request-window";
import { createRequest, MAX_REQUEST_PHOTOS } from "@/lib/requests";
import { Priority } from "@/generated/prisma/enums";
import { docRef } from "@/lib/series";

const HOUR = 3_600_000;
const MAX_PER_ASSET_PER_HOUR = 5;
const MAX_PER_ORG_PER_HOUR = 40;

const schema = z
  .object({
    name: str(120),
    phone: optStr(40),
    email: z.preprocess((v) => (v ? v : undefined), z.email().max(200).optional()).transform((v) => v ?? null),
    title: str(200),
    description: optStr(5000),
    priority: enumOf(Priority).default("MEDIUM"),
    availableFrom: optDate(),
    availableTo: optDate(),
  })
  .refine((d) => d.phone || d.email, { path: ["phone"], message: "contactRequired" });

export type PublicResult = FormResult & { number?: string };

/** Anonymous request from an asset's QR label. */
export async function publicRequestAction(token: string, _: PublicResult, form: FormData): Promise<PublicResult> {
  // Honeypot: real users never see or fill this field.
  if (String(form.get("website") ?? "")) return { ok: true };

  const asset = await prisma.asset.findUnique({
    where: { qrToken: token },
    select: { id: true, organizationId: true, villaId: true, areaId: true, system: true, archivedAt: true },
  });
  if (!asset || asset.archivedAt) return { error: "somethingWrong" };

  const parsed = parseForm(schema, form);
  if (parsed.error) return parsed.error;
  const d = parsed.data;
  const bad = windowError(d);
  if (bad) return { error: "validation", fieldErrors: { [bad.field]: bad.code } };

  const since = new Date(Date.now() - HOUR);
  const [forAsset, forOrg] = await Promise.all([
    prisma.request.count({ where: { assetId: asset.id, requesterId: null, createdAt: { gte: since } } }),
    prisma.request.count({ where: { organizationId: asset.organizationId, requesterId: null, createdAt: { gte: since } } }),
  ]);
  if (forAsset >= MAX_PER_ASSET_PER_HOUR || forOrg >= MAX_PER_ORG_PER_HOUR) return { error: "qr.tooMany" };

  const photos = form.getAll("photos").filter((f): f is File => f instanceof File).slice(0, MAX_REQUEST_PHOTOS);
  const req = await createRequest(
    tenantDb(asset.organizationId),
    asset.organizationId,
    {
      title: d.title,
      description: d.description,
      priority: d.priority,
      villaId: asset.villaId,
      areaId: asset.areaId,
      assetId: asset.id,
      system: asset.system,
      requesterName: d.name,
      requesterPhone: d.phone,
      requesterEmail: d.email,
      availableFrom: d.availableFrom,
      availableTo: d.availableTo,
    },
    photos,
  );
  return { ok: true, number: docRef(req) };
}
