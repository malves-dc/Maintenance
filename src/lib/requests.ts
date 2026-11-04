import "server-only";
import { randomBytes } from "node:crypto";
import { nextNumber, type TenantDb } from "@/lib/db/tenant";
import { prisma } from "@/lib/db/client";
import { membersWith, notify, notifyExternal, type NotifyActor } from "@/lib/notify";
import { requestOnCallUsers } from "@/lib/on-call-db";
import { canReschedule, needsConfirmedSlot, slotText } from "@/lib/request-window";
import { putObject } from "@/lib/storage";
import { createWorkOrder, type WoCtx, type WorkOrderInput } from "@/lib/work-orders";
import type { Priority, SystemType } from "@/generated/prisma/enums";

export const MAX_REQUEST_PHOTOS = 4;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const PHOTO_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export type RequestInput = {
  title: string;
  description?: string | null;
  priority?: Priority;
  system?: SystemType | null;
  villaId?: string | null;
  areaId?: string | null;
  assetId?: string | null;
  requesterId?: string | null;
  requesterName?: string | null;
  requesterEmail?: string | null;
  requesterPhone?: string | null;
  /** When the work can be done, as given by the client (checked with `windowError`). */
  availableFrom?: Date | null;
  availableTo?: Date | null;
};

/** Thrown when a request with a client window is approved without a confirmed visit time. */
export class RequestError extends Error {
  constructor(public code: "notPending" | "slotRequired" | "notSchedulable") {
    super(code);
  }
}

/**
 * Creates a request (portal, QR form or staff) and stores its photos.
 * Callers are responsible for having validated villa/asset scope for the submitter.
 */
export async function createRequest(db: TenantDb, organizationId: string, input: RequestInput, photos: File[] = []) {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { id: true, name: true, timezone: true, onCallHours: true, businessHours: true } });
  const onCallIds = await requestOnCallUsers(db, org, input.system ?? null);
  const number = await nextNumber(organizationId, "request");
  const req = await db.request.create({
    data: {
      organizationId,
      number,
      title: input.title,
      description: input.description ?? null,
      priority: input.priority ?? "NONE",
      system: input.system ?? null,
      villaId: input.villaId ?? null,
      areaId: input.areaId ?? null,
      assetId: input.assetId ?? null,
      requesterId: input.requesterId ?? null,
      requesterName: input.requesterName ?? null,
      requesterEmail: input.requesterEmail ?? null,
      requesterPhone: input.requesterPhone ?? null,
      availableFrom: input.availableFrom ?? null,
      availableTo: input.availableTo ?? null,
      // Server-side lookup, not user input; User isn't a tenant model.
      onCallUsers: { connect: onCallIds.map((id) => ({ id })) },
    },
    include: { onCallUsers: { select: { id: true } } },
  });

  const month = new Date().toISOString().slice(0, 7);
  for (const file of photos.slice(0, MAX_REQUEST_PHOTOS)) {
    const ext = PHOTO_TYPES[file.type];
    if (!ext || file.size === 0 || file.size > MAX_PHOTO_BYTES) continue;
    const ref = await putObject(`${organizationId}/${month}/${randomBytes(12).toString("hex")}.${ext}`, Buffer.from(await file.arrayBuffer()));
    await db.attachment.create({
      data: {
        organizationId,
        url: ref,
        filename: file.name.slice(0, 200) || `photo.${ext}`,
        mimeType: file.type,
        size: file.size,
        uploadedById: input.requesterId ?? null,
        requestId: req.id,
      },
    });
  }

  const villa = req.villaId ? await db.villa.findUnique({ where: { id: req.villaId }, select: { name: true } }) : null;
  // Approvers, plus whoever on call gets it (who may not be an approver).
  const recipients = new Set([...(await membersWith(db, "requests.approve")), ...onCallIds]);
  await notify({ organization: org, user: input.requesterId ? { id: input.requesterId } : null }, [...recipients], {
    type: "REQUEST_NEW",
    data: { number: req.number, title: req.title, place: [villa?.name, input.requesterName].filter(Boolean).join(" · ") },
    link: `/requests/${req.id}`,
  });
  return req;
}

/** REQUEST_UPDATE to whoever asked: in-app for portal users, by email for QR-form requesters. */
export async function notifyRequester(
  ctx: NotifyActor & { organization: { defaultLocale: string; timezone: string } },
  req: { id: string; number: number; title: string; requesterId: string | null; requesterEmail: string | null },
  status: "APPROVED" | "DECLINED" | "SCHEDULED" | "RESCHEDULED",
  reason: string | null = null,
  visit: Date | null = null,
) {
  const data = {
    number: req.number,
    title: req.title,
    status,
    when: visit ? slotText(visit, ctx.organization.timezone) : "",
    detail: reason ? `${req.title} — ${reason}` : req.title,
  };
  if (req.requesterId) await notify(ctx, [req.requesterId], { type: "REQUEST_UPDATE", data, link: `/portal/requests/${req.id}` });
  else await notifyExternal(ctx.organization, req.requesterEmail, ctx.organization.defaultLocale, "REQUEST_UPDATE", data);
}

/**
 * Turns a pending request into a work order (with overrides) and links the request's photos to it.
 * `scheduledFor` is the visit confirmed to the client: required when the client gave a window, and it
 * becomes the work order's start date.
 */
export async function approveRequest(ctx: WoCtx, requestId: string, overrides: Partial<WorkOrderInput>, scheduledFor: Date | null = null) {
  const req = await ctx.db.request.findUnique({ where: { id: requestId } });
  if (!req || req.status !== "PENDING") throw new RequestError("notPending");
  if (!scheduledFor && needsConfirmedSlot(req)) throw new RequestError("slotRequired");
  const wo = await createWorkOrder(ctx, {
    title: req.title,
    description: [req.description, requesterLine(req)].filter(Boolean).join("\n\n"),
    priority: req.priority,
    system: req.system,
    villaId: req.villaId,
    areaId: req.areaId,
    assetId: req.assetId,
    type: "REACTIVE",
    ...overrides,
    ...(scheduledFor ? { startDate: scheduledFor } : {}),
  });
  const claimed = await ctx.db.request.updateMany({
    where: { id: requestId, status: "PENDING" },
    data: { status: "APPROVED", workOrderId: wo.id, scheduledFor },
  });
  if (claimed.count !== 1) {
    await ctx.db.workOrder.delete({ where: { id: wo.id } }); // someone else approved it first
    throw new RequestError("notPending");
  }
  await ctx.db.attachment.updateMany({ where: { requestId }, data: { workOrderId: wo.id } });
  await notifyRequester(ctx, req, scheduledFor ? "SCHEDULED" : "APPROVED", null, scheduledFor);
  return wo;
}

/**
 * Confirms (or moves) the visit of an approved request whose job isn't finished: the request shows it to
 * the client and the work order starts then. The client is told when it changes.
 */
export async function scheduleRequest(ctx: WoCtx, requestId: string, when: Date) {
  const req = await ctx.db.request.findUnique({ where: { id: requestId }, include: { workOrder: { select: { id: true, status: true } } } });
  if (!req || !req.workOrder || !canReschedule(req.status, req.workOrder.status)) throw new RequestError("notSchedulable");
  if (req.scheduledFor?.getTime() === when.getTime()) return;
  await ctx.db.request.update({ where: { id: req.id }, data: { scheduledFor: when } });
  await ctx.db.workOrder.update({ where: { id: req.workOrder.id }, data: { startDate: when } });
  await notifyRequester(ctx, req, req.scheduledFor ? "RESCHEDULED" : "SCHEDULED", null, when);
}

function requesterLine(r: { requesterName: string | null; requesterPhone: string | null; requesterEmail: string | null }) {
  const who = [r.requesterName, r.requesterPhone, r.requesterEmail].filter(Boolean).join(" · ");
  return who ? `— ${who}` : null;
}

export async function declineRequest(db: TenantDb, requestId: string, reason: string | null) {
  const res = await db.request.updateMany({
    where: { id: requestId, status: "PENDING" },
    data: { status: "DECLINED", declineReason: reason },
  });
  if (res.count !== 1) throw new RequestError("notPending");
}
