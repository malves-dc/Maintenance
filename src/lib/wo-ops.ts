import "server-only";
import { z } from "zod";
import { changeStatus, WorkOrderError, type WoCtx } from "@/lib/work-orders";
import { recordReading } from "@/lib/meters";
import { notify } from "@/lib/notify";
import { excerpt, findMentions } from "@/lib/mentions";
import type { WorkMode } from "@/generated/prisma/enums";

// Technician actions on a work order, shared by the web app's server actions and the offline
// field app's sync endpoint so both behave identically. `at` is when it happened on the device
// (offline changes arrive later); it is clamped to the past 30 days and never in the future.

const MAX_AGE_MS = 30 * 86_400_000;

export function clampAt(at: Date | string | number | null | undefined, now = new Date()) {
  const d = at ? new Date(at) : now;
  if (isNaN(d.getTime()) || d > now) return now;
  return d.getTime() < now.getTime() - MAX_AGE_MS ? new Date(now.getTime() - MAX_AGE_MS) : d;
}

/**
 * Answers a checklist item. Returns "stale" (and changes nothing) when the item was answered by
 * someone else after `at` — the later answer wins.
 */
export async function answerItem(ctx: WoCtx, woId: string, itemId: string, value: string | null, note?: string | null, atInput?: Date) {
  const wo = await ctx.db.workOrder.findUnique({ where: { id: woId }, select: { status: true } });
  if (!wo) throw new WorkOrderError("invalidRef");
  if (wo.status === "DONE" || wo.status === "CANCELLED") throw new WorkOrderError("locked");
  const item = await ctx.db.workOrderItem.findFirst({ where: { id: itemId, workOrderId: woId } });
  if (!item) throw new WorkOrderError("invalidRef");
  const at = atInput ?? new Date();
  if (atInput && item.completedAt && item.completedAt > at && item.completedById !== ctx.user.id) return "stale" as const;

  let v = value === null ? null : z.string().max(5000).parse(value).trim() || null;
  if (v !== null) {
    if (item.type === "NUMBER" || item.type === "METER_READING") v = String(z.coerce.number().finite().parse(v));
    if (item.type === "PASS_FAIL") v = z.enum(["PASS", "FAIL", "FLAG", "NA"]).parse(v);
    if (item.type === "CHECKBOX") v = z.enum(["true", "false"]).parse(v);
    if (item.type === "MULTIPLE_CHOICE" && !item.options.includes(v)) throw new WorkOrderError("invalidRef");
    // Photo/signature answers point at an attachment on this work order.
    if ((item.type === "PHOTO" || item.type === "SIGNATURE") && !(await ctx.db.attachment.count({ where: { id: v, workOrderId: woId } }))) {
      throw new WorkOrderError("invalidRef");
    }
  }
  await ctx.db.workOrderItem.update({
    where: { id: itemId },
    data: {
      value: v,
      note: note === undefined ? undefined : note?.slice(0, 2000) || null,
      completedById: v ? ctx.user.id : null,
      completedAt: v ? at : null,
    },
  });
  // Meter-reading steps also log the reading on the meter (limits, meter-based PMs, alerts).
  if (v !== null && item.type === "METER_READING" && item.meterId && v !== item.value) {
    await recordReading(ctx, item.meterId, Number(v), woId);
  }
  // Starting the checklist on an open WO counts as starting work.
  if (v && wo.status === "OPEN") await changeStatus(ctx, woId, "IN_PROGRESS");
  return "applied" as const;
}

/** Adds a comment (optionally with photos already uploaded to the WO) and notifies people. */
export async function addComment(ctx: WoCtx, woId: string, body: string, attachmentIds: string[] = [], at = new Date()) {
  const text = z.string().trim().max(5000).parse(body);
  if (!text && attachmentIds.length === 0) return null;
  const wo = await ctx.db.workOrder.findUnique({ where: { id: woId }, select: { number: true, title: true, createdById: true, assignees: { select: { userId: true } } } });
  if (!wo) throw new WorkOrderError("invalidRef");
  const comment = await ctx.db.workOrderComment.create({ data: { workOrderId: woId, userId: ctx.user.id, body: text, createdAt: at } });
  if (attachmentIds.length) {
    await ctx.db.attachment.updateMany({
      where: { id: { in: attachmentIds }, workOrderId: woId, uploadedById: ctx.user.id, commentId: null },
      data: { commentId: comment.id },
    });
  }

  // @mentioned staff get MENTION; the WO's creator and assignees get WO_COMMENT.
  const staff = await ctx.db.membership.findMany({ where: { active: true, role: { not: "REQUESTER" } }, select: { user: { select: { id: true, name: true } } } });
  const mentioned = findMentions(text, staff.map((m) => m.user));
  const data = { number: wo.number, title: wo.title, actor: ctx.user.name, excerpt: excerpt(text), where: `#${wo.number}` };
  const link = `/work-orders/${woId}`;
  await notify(ctx, mentioned, { type: "MENTION", data, link });
  await notify(ctx, [wo.createdById, ...wo.assignees.map((a) => a.userId)].filter((u) => !mentioned.includes(u)), { type: "WO_COMMENT", data, link });
  return comment;
}

/** A finished time interval (manual entry, or a timer run on the device while offline). */
export async function addTimeEntry(ctx: WoCtx, woId: string, rate: unknown, startedAt: Date, endedAt: Date, note: string | null, mode: WorkMode = "ONSITE") {
  const minutes = Math.round((endedAt.getTime() - startedAt.getTime()) / 60_000);
  if (minutes < 1 || minutes > 24 * 60) throw new WorkOrderError("invalidRef");
  const wo = await ctx.db.workOrder.findUnique({ where: { id: woId }, select: { status: true } });
  if (!wo) throw new WorkOrderError("invalidRef");
  const entry = await ctx.db.timeEntry.create({
    data: { workOrderId: woId, userId: ctx.user.id, startedAt, endedAt, minutes, note: note?.slice(0, 500) || null, hourlyRate: rate as number | null, mode },
  });
  if (wo.status === "OPEN" || wo.status === "ON_HOLD") await changeStatus(ctx, woId, "IN_PROGRESS");
  return entry;
}

/** The client signs the work order (the signature is an image already uploaded to it). */
export async function signOff(ctx: WoCtx, woId: string, signedByName: string, attachmentId: string, at = new Date()) {
  const name = z.string().trim().min(1).max(150).parse(signedByName);
  const att = await ctx.db.attachment.findFirst({ where: { id: attachmentId, workOrderId: woId, mimeType: "image/png" } });
  if (!att) throw new WorkOrderError("invalidRef");
  await ctx.db.workOrder.update({ where: { id: woId }, data: { signatureUrl: att.id, signedByName: name, signedAt: at, clientAbsent: false } });
}

export const WORK_REPORT_MAX = 10_000;

/** The technician's report ("what was done"), required to complete the job. Closed jobs can't change it. */
export async function setWorkReport(ctx: WoCtx, woId: string, text: string | null) {
  const report = text === null ? null : z.string().max(WORK_REPORT_MAX).parse(text).trim() || null;
  const wo = await ctx.db.workOrder.findUnique({ where: { id: woId }, select: { status: true, workReport: true } });
  if (!wo) throw new WorkOrderError("invalidRef");
  if (wo.status === "DONE" || wo.status === "CANCELLED") throw new WorkOrderError("locked");
  if (report !== wo.workReport) await ctx.db.workOrder.update({ where: { id: woId }, data: { workReport: report } });
}

/** "Client absent": no client signature is needed. Not possible once the client has signed. */
export async function setClientAbsent(ctx: WoCtx, woId: string, absent: boolean) {
  const wo = await ctx.db.workOrder.findUnique({ where: { id: woId }, select: { signatureUrl: true, status: true } });
  if (!wo) throw new WorkOrderError("invalidRef");
  if (absent && wo.signatureUrl) throw new WorkOrderError("alreadySigned");
  // A completed job must stay signed off; reopen it first.
  if (!absent && wo.status === "DONE" && !wo.signatureUrl) throw new WorkOrderError("locked");
  await ctx.db.workOrder.update({ where: { id: woId }, data: { clientAbsent: absent } });
}
