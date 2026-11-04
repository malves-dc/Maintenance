"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getContext, requirePermission, type AppContext } from "@/lib/context";
import { enumOf, optEnumOf, optId, optNumber, optStr, parseForm, str, type FormResult } from "@/lib/forms";
import { deleteObject } from "@/lib/storage";
import { addComment, answerItem, setClientAbsent, setWorkReport, signOff, WORK_REPORT_MAX } from "@/lib/wo-ops";
import { consumePart, InventoryError, returnPart } from "@/lib/inventory";
import { contractFor } from "@/lib/contracts";
import {
  changeStatus,
  createWorkOrder,
  myRateOn,
  notifyAssigned,
  resolveRefs,
  restampRate,
  stopRunningTimers,
  validateAssignees,
  validateCategories,
  WorkOrderError,
} from "@/lib/work-orders";
import { ChecklistItemType, Priority, SystemType, WorkMode, WorkOrderStatus, WorkOrderType } from "@/generated/prisma/enums";
import { emailConfigured } from "@/lib/email";
import { reportRecipients, sendServiceReport } from "@/lib/report-email";
import { WORK_ORDER_BUILT_IN_ROLE } from "@/lib/roles";
import { MAX_EXTRA, parseEmailList } from "@/lib/report-recipients";

const path = (id: string) => `/work-orders/${id}`;

/** Loads a WO the current user may edit (managers, or its creator/assignees with create rights). */
async function editableWorkOrder(ctx: AppContext, id: string) {
  const wo = await ctx.db.workOrder.findUnique({ where: { id }, include: { assignees: true } });
  if (!wo) throw new Error("Not found");
  const involved = wo.createdById === ctx.user.id || wo.assignees.some((a) => a.userId === ctx.user.id);
  if (!ctx.can("workOrders.manage") && !(ctx.can("workOrders.create") && involved)) throw new Error("Forbidden");
  return wo;
}

async function executableWorkOrder(id: string) {
  const ctx = await requirePermission("workOrders.execute");
  const wo = await ctx.db.workOrder.findUnique({ where: { id } });
  if (!wo) throw new Error("Not found");
  return { ctx, wo };
}

// ── Create / edit

const woSchema = z.object({
  title: str(200),
  description: optStr(10000),
  priority: enumOf(Priority),
  type: enumOf(WorkOrderType),
  system: optEnumOf(SystemType),
  villaId: optId(),
  areaId: optId(),
  assetId: optId(),
  teamId: optId(),
  procedureId: optId(), // create only: copies the procedure's steps
  clientVisible: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  dueDate: z.preprocess((v) => (v ? v : undefined), z.coerce.date().optional()).transform((v) => v ?? null),
  startDate: z.preprocess((v) => (v ? v : undefined), z.coerce.date().optional()).transform((v) => v ?? null),
  estimatedHours: optNumber().refine((v) => v === null || (v >= 0 && v <= 1000)),
});

export async function saveWorkOrderAction(id: string | null, _: FormResult, form: FormData): Promise<FormResult> {
  const ctx = await requirePermission("workOrders.create");
  const parsed = parseForm(woSchema, form);
  if (parsed.error) return parsed.error;
  const { estimatedHours, ...data } = parsed.data;
  const assigneeIds = form.getAll("assigneeIds").map(String).filter(Boolean);
  const fields = { ...data, estimatedMinutes: estimatedHours === null ? null : Math.round(estimatedHours * 60) };
  const categoryIds = form.getAll("categoryIds").map(String).filter(Boolean);
  const input = { ...fields, assigneeIds, categoryIds };

  let woId = id;
  try {
    if (id) {
      const before = await editableWorkOrder(ctx, id);
      const refs = await resolveRefs(ctx, input);
      const ids = await validateAssignees(ctx, assigneeIds);
      const cats = await validateCategories(ctx, categoryIds);
      const wo = await ctx.db.workOrder.update({
        where: { id },
        data: {
          ...fields,
          procedureId: undefined,
          ...refs,
          // Villa or system may have changed: re-pick the covering contract (as of when the job was opened).
          contractId: await contractFor(ctx.db, refs.villaId, refs.system, before.createdAt),
          // People who stay on the job keep the role they took on it.
          assignees: {
            deleteMany: {},
            create: ids.map((userId) => {
              const was = before.assignees.find((a) => a.userId === userId);
              return { userId, role: was?.role, jobRoleId: was?.jobRoleId };
            }),
          },
          categories: { set: cats.map((c) => ({ id: c })) },
        },
      });
      const had = new Set(before.assignees.map((a) => a.userId));
      await notifyAssigned(ctx, wo, ids.filter((u) => !had.has(u)));
    } else {
      woId = (await createWorkOrder(ctx, input)).id;
    }
  } catch (e) {
    if (e instanceof WorkOrderError) return { error: `wo.${e.code}` };
    throw e;
  }
  revalidatePath("/work-orders");
  redirect(path(woId!));
}

export async function deleteWorkOrderAction(id: string) {
  const ctx = await requirePermission("workOrders.manage");
  const atts = await ctx.db.attachment.findMany({ where: { workOrderId: id }, select: { url: true } });
  await ctx.db.workOrder.delete({ where: { id } });
  await Promise.all(atts.map((a) => deleteObject(a.url)));
  revalidatePath("/work-orders");
  redirect("/work-orders");
}

// ── Assignee roles

/**
 * The role someone takes on this job: "" (their own), Technician, or one of the company's roles (its id); never the
 * office, finance or client roles. Their time on the job is then charged at that role's rate. Assignees set their
 * own, managers anyone's; locked once the job is closed.
 */
export async function setAssigneeRoleAction(id: string, userId: string, choice: string) {
  const ctx = await requirePermission("workOrders.execute");
  if (userId !== ctx.user.id && !ctx.can("workOrders.manage")) throw new Error("Forbidden");
  const wo = await ctx.db.workOrder.findUnique({ where: { id }, select: { status: true, assignees: { where: { userId }, select: { userId: true } } } });
  if (!wo || !wo.assignees.length) throw new Error("Not found");
  if (wo.status === "DONE" || wo.status === "CANCELLED") throw new Error("Closed");
  let data: { role: typeof WORK_ORDER_BUILT_IN_ROLE | null; jobRoleId: string | null } = { role: null, jobRoleId: null };
  if (choice === WORK_ORDER_BUILT_IN_ROLE) data = { role: WORK_ORDER_BUILT_IN_ROLE, jobRoleId: null };
  else if (choice) {
    const jobRole = await ctx.db.jobRole.findFirst({ where: { id: choice }, select: { id: true } });
    if (!jobRole) throw new Error("Invalid role");
    data = { role: null, jobRoleId: jobRole.id };
  }
  await ctx.db.workOrder.update({
    where: { id },
    data: { assignees: { update: { where: { workOrderId_userId: { workOrderId: id, userId } }, data } } },
  });
  await restampRate(ctx, id, userId);
  revalidatePath(path(id));
}

// ── Status

export async function setStatusAction(id: string, status: WorkOrderStatus, note?: string): Promise<{ error?: string }> {
  const ctx = await requirePermission("workOrders.execute");
  try {
    await changeStatus(ctx, id, enumOf(WorkOrderStatus).parse(status), note ? z.string().max(1000).parse(note) : null);
  } catch (e) {
    if (e instanceof WorkOrderError) return { error: `wo.${e.code}` };
    throw e;
  }
  revalidatePath(path(id));
  revalidatePath("/work-orders");
  return {};
}

// ── Checklist

const itemSchema = z.object({
  type: enumOf(ChecklistItemType),
  label: z.string().trim().min(1).max(300),
  required: z.boolean().default(false),
  options: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
  unit: z.string().trim().max(20).nullable().default(null),
  meterId: z.string().max(40).nullable().default(null),
});

export async function addItemAction(woId: string, input: z.input<typeof itemSchema>) {
  const ctx = await getContext();
  const wo = await editableWorkOrder(ctx, woId);
  const item = itemSchema.parse(input);
  if (item.meterId) {
    // Only meters on this work order's asset.
    const ok = wo.assetId && (await ctx.db.meter.count({ where: { id: item.meterId, assetId: wo.assetId } }));
    if (!ok || item.type !== "METER_READING") item.meterId = null;
  }
  const last = await ctx.db.workOrderItem.findFirst({ where: { workOrderId: woId }, orderBy: { sortOrder: "desc" } });
  await ctx.db.workOrderItem.create({ data: { ...item, workOrderId: woId, sortOrder: (last?.sortOrder ?? -1) + 1 } });
  revalidatePath(path(woId));
}

/** Appends a procedure's steps to an existing work order's checklist. */
export async function applyProcedureAction(woId: string, procedureId: string) {
  const ctx = await getContext();
  const wo = await editableWorkOrder(ctx, woId);
  const proc = await ctx.db.procedure.findUnique({ where: { id: procedureId }, include: { items: { orderBy: { sortOrder: "asc" } } } });
  if (!proc) throw new Error("Not found");
  const last = await ctx.db.workOrderItem.findFirst({ where: { workOrderId: woId }, orderBy: { sortOrder: "desc" } });
  const meters = wo.assetId ? await ctx.db.meter.findMany({ where: { assetId: wo.assetId }, select: { id: true, unit: true } }) : [];
  const base = (last?.sortOrder ?? -1) + 1;
  await ctx.db.workOrderItem.createMany({
    data: proc.items.map((it, i) => {
      const match = it.type === "METER_READING" ? meters.filter((m) => !it.unit || m.unit.toLowerCase() === it.unit.toLowerCase()) : [];
      return {
        workOrderId: woId,
        sortOrder: base + i,
        type: it.type,
        label: it.label,
        description: it.description,
        required: it.required,
        options: it.options,
        unit: it.unit,
        meterId: match.length === 1 ? match[0].id : null,
      };
    }),
  });
  if (!wo.procedureId) await ctx.db.workOrder.update({ where: { id: woId }, data: { procedureId } });
  revalidatePath(path(woId));
}

export async function deleteItemAction(woId: string, itemId: string) {
  const ctx = await getContext();
  await editableWorkOrder(ctx, woId);
  await ctx.db.workOrderItem.deleteMany({ where: { id: itemId, workOrderId: woId } });
  revalidatePath(path(woId));
}

export async function moveItemAction(woId: string, itemId: string, direction: -1 | 1) {
  const ctx = await getContext();
  await editableWorkOrder(ctx, woId);
  const items = await ctx.db.workOrderItem.findMany({ where: { workOrderId: woId }, orderBy: { sortOrder: "asc" } });
  const i = items.findIndex((x) => x.id === itemId);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= items.length) return;
  [items[i], items[j]] = [items[j], items[i]];
  await ctx.db.$transaction(items.map((it, idx) => ctx.db.workOrderItem.update({ where: { id: it.id }, data: { sortOrder: idx } })));
  revalidatePath(path(woId));
}

export async function answerItemAction(woId: string, itemId: string, value: string | null, note?: string | null) {
  const { ctx } = await executableWorkOrder(woId);
  await answerItem(ctx, woId, itemId, value, note);
  revalidatePath(path(woId));
}

// ── Time tracking

/** On site unless the value says remote (a stale client or a bad value never makes work remote by accident). */
const workMode = (v: unknown): WorkMode => (v === WorkMode.REMOTE ? WorkMode.REMOTE : WorkMode.ONSITE);

export async function startTimerAction(woId: string, mode: WorkMode = WorkMode.ONSITE) {
  const { ctx, wo } = await executableWorkOrder(woId);
  const running = await ctx.db.timeEntry.findFirst({ where: { workOrderId: woId, userId: ctx.user.id, endedAt: null } });
  if (!running) {
    await ctx.db.timeEntry.create({
      data: { workOrderId: woId, userId: ctx.user.id, startedAt: new Date(), hourlyRate: await myRateOn(ctx, woId), mode: workMode(mode) },
    });
  }
  if (wo.status === "OPEN" || wo.status === "ON_HOLD") await changeStatus(ctx, woId, "IN_PROGRESS");
  revalidatePath(path(woId));
}

export async function stopTimerAction(woId: string) {
  const { ctx } = await executableWorkOrder(woId);
  await stopRunningTimers(ctx, woId, new Date(), ctx.user.id);
  revalidatePath(path(woId));
}

const timeSchema = z.object({
  minutes: z.coerce.number().int().min(1).max(24 * 60),
  date: z.coerce.date(),
  note: optStr(500),
});

export async function addTimeAction(woId: string, _: FormResult, form: FormData): Promise<FormResult> {
  const { ctx } = await executableWorkOrder(woId);
  const parsed = parseForm(timeSchema, form);
  if (parsed.error) return parsed.error;
  const { minutes, date, note } = parsed.data;
  await ctx.db.timeEntry.create({
    data: {
      workOrderId: woId,
      userId: ctx.user.id,
      startedAt: date,
      endedAt: new Date(date.getTime() + minutes * 60_000),
      minutes,
      note,
      hourlyRate: await myRateOn(ctx, woId),
      mode: workMode(form.get("mode")),
    },
  });
  revalidatePath(path(woId));
  return { ok: true };
}

/** Corrects where a time entry was worked (on site / remote): my own entries, or anyone's with workOrders.manage. */
export async function setTimeModeAction(woId: string, entryId: string, mode: WorkMode) {
  const { ctx } = await executableWorkOrder(woId);
  const own = ctx.can("workOrders.manage") ? {} : { userId: ctx.user.id };
  await ctx.db.timeEntry.updateMany({ where: { id: entryId, workOrderId: woId, ...own }, data: { mode: workMode(mode) } });
  revalidatePath(path(woId));
}

export async function deleteTimeAction(woId: string, entryId: string) {
  const { ctx } = await executableWorkOrder(woId);
  const own = ctx.can("workOrders.manage") ? {} : { userId: ctx.user.id };
  await ctx.db.timeEntry.deleteMany({ where: { id: entryId, workOrderId: woId, ...own } });
  revalidatePath(path(woId));
}

// ── Comments & attachments

export async function addCommentAction(woId: string, body: string, attachmentIds: string[] = []) {
  const { ctx } = await executableWorkOrder(woId);
  await addComment(ctx, woId, body, attachmentIds);
  revalidatePath(path(woId));
}

export async function deleteAttachmentAction(woId: string, attachmentId: string) {
  const { ctx } = await executableWorkOrder(woId);
  const own = ctx.can("workOrders.manage") ? {} : { uploadedById: ctx.user.id };
  const att = await ctx.db.attachment.findFirst({ where: { id: attachmentId, workOrderId: woId, ...own } });
  if (!att) return;
  await ctx.db.attachment.delete({ where: { id: att.id } });
  await deleteObject(att.url);
  // A photo answer pointing at this file is cleared too.
  if (att.workOrderItemId) {
    await ctx.db.workOrderItem.updateMany({ where: { id: att.workOrderItemId, value: att.id }, data: { value: null, completedAt: null, completedById: null } });
  }
  revalidatePath(path(woId));
}

// ── Other costs

const costSchema = z.object({ description: str(200), amount: z.coerce.number().finite().min(0).max(10_000_000) });

export async function addCostAction(woId: string, _: FormResult, form: FormData): Promise<FormResult> {
  const { ctx } = await executableWorkOrder(woId);
  const parsed = parseForm(costSchema, form);
  if (parsed.error) return parsed.error;
  await ctx.db.workOrderCost.create({ data: { ...parsed.data, workOrderId: woId } });
  revalidatePath(path(woId));
  return { ok: true };
}

export async function deleteCostAction(woId: string, costId: string) {
  const { ctx } = await executableWorkOrder(woId);
  await ctx.db.workOrderCost.deleteMany({ where: { id: costId, workOrderId: woId } });
  revalidatePath(path(woId));
}

// ── Parts used

const partUseSchema = z.object({
  partId: str(40),
  locationId: str(40),
  quantity: z.coerce.number().finite().positive().max(100_000),
});

export async function addPartAction(woId: string, _: FormResult, form: FormData): Promise<FormResult> {
  const { ctx } = await executableWorkOrder(woId);
  if (!ctx.can("inventory.use")) throw new Error("Forbidden");
  const parsed = parseForm(partUseSchema, form);
  if (parsed.error) return parsed.error;
  const { partId, locationId, quantity } = parsed.data;
  const serials = String(form.get("serials") ?? "").split(/[\n,;]+/);
  try {
    await consumePart(ctx, woId, partId, locationId, quantity, serials);
  } catch (e) {
    if (e instanceof InventoryError) return { error: `stock.${e.code}` };
    throw e;
  }
  revalidatePath(path(woId));
  return { ok: true };
}

export async function returnPartAction(woId: string, workOrderPartId: string) {
  const { ctx } = await executableWorkOrder(woId);
  if (!ctx.can("inventory.use")) throw new Error("Forbidden");
  await returnPart(ctx, woId, workOrderPartId);
  revalidatePath(path(woId));
}

// ── Technician's report

const workReportSchema = z.object({ workReport: optStr(WORK_REPORT_MAX) });

export async function saveWorkReportAction(woId: string, _: FormResult, form: FormData): Promise<FormResult> {
  const { ctx } = await executableWorkOrder(woId);
  const parsed = parseForm(workReportSchema, form);
  if (parsed.error) return parsed.error;
  try {
    await setWorkReport(ctx, woId, parsed.data.workReport);
  } catch (e) {
    if (e instanceof WorkOrderError) return { error: `wo.${e.code}` };
    throw e;
  }
  revalidatePath(path(woId));
  return { ok: true };
}

// ── Client sign-off

export async function signOffAction(woId: string, signedByName: string, attachmentId: string) {
  const { ctx } = await executableWorkOrder(woId);
  await signOff(ctx, woId, signedByName, attachmentId);
  revalidatePath(path(woId));
}

export async function setClientAbsentAction(woId: string, absent: boolean) {
  const { ctx } = await executableWorkOrder(woId);
  await setClientAbsent(ctx, woId, absent);
  revalidatePath(path(woId));
}

export async function clearSignOffAction(woId: string) {
  const { ctx, wo } = await executableWorkOrder(woId);
  // A completed job must stay signed off; reopen it first.
  if (wo.status === "DONE" && !wo.clientAbsent) throw new WorkOrderError("locked");
  if (wo.signatureUrl) {
    const att = await ctx.db.attachment.findUnique({ where: { id: wo.signatureUrl } });
    if (att) {
      await ctx.db.attachment.delete({ where: { id: att.id } });
      await deleteObject(att.url);
    }
  }
  await ctx.db.workOrder.update({ where: { id: woId }, data: { signatureUrl: null, signedByName: null, signedAt: null } });
  revalidatePath(path(woId));
}

// ── Service report by e-mail

/**
 * Sends the PDF service report. Ticked addresses must come from the work order's default recipients
 * (recomputed here, so the form can't add hidden ones); extra addresses are typed by the sender.
 */
export async function sendReportAction(woId: string, _: FormResult, form: FormData): Promise<FormResult> {
  const ctx = await requirePermission("workOrders.sendReport");
  if (!(await emailConfigured())) return { error: "reportEmail.notConfigured" };
  const found = await reportRecipients(ctx, woId);
  if (!found) return { error: "somethingWrong" };
  const offered = new Set(found.recipients.map((r) => r.email));
  const ticked = form.getAll("to").map(String).filter((e) => offered.has(e));
  const extra = parseEmailList(String(form.get("extra") ?? ""));
  if (extra.invalid.length) return { error: "validation", fieldErrors: { extra: "badEmails" } };
  if (extra.emails.length > MAX_EXTRA) return { error: "validation", fieldErrors: { extra: "too_big" } };
  const to = [...new Set([...ticked, ...extra.emails])];
  if (to.length === 0) return { error: "reportEmail.noRecipients" };
  await sendServiceReport(ctx, woId, to);
  revalidatePath(path(woId));
  return { ok: true };
}
