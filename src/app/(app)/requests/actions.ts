"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getContext } from "@/lib/context";
import { enumOf, optDate, optEnumOf, optId, parseForm, str, type FormResult } from "@/lib/forms";
import { approveRequest, declineRequest, notifyRequester, RequestError, scheduleRequest } from "@/lib/requests";
import { WorkOrderError } from "@/lib/work-orders";
import { Priority, SystemType, WorkOrderType } from "@/generated/prisma/enums";

const approveSchema = z.object({
  title: str(200),
  priority: enumOf(Priority),
  type: enumOf(WorkOrderType),
  system: optEnumOf(SystemType),
  teamId: optId(),
  dueDate: optDate(),
  scheduledFor: optDate(),
});

export async function approveRequestAction(id: string, _: FormResult, form: FormData): Promise<FormResult> {
  const ctx = await handlerOf(id);
  const parsed = parseForm(approveSchema, form);
  if (parsed.error) return parsed.error;
  const { scheduledFor, ...overrides } = parsed.data;
  let woId: string;
  try {
    const wo = await approveRequest(ctx, id, { ...overrides, assigneeIds: form.getAll("assigneeIds").map(String).filter(Boolean) }, scheduledFor);
    woId = wo.id;
  } catch (e) {
    if (e instanceof WorkOrderError) return { error: `wo.${e.code}` };
    if (e instanceof RequestError && e.code === "slotRequired") return { error: "validation", fieldErrors: { scheduledFor: "slotRequired" } };
    return { error: "requests.notPending" };
  }
  revalidatePath("/requests");
  revalidatePath("/work-orders");
  redirect(`/work-orders/${woId}`);
}

/** Confirms or moves the visit of an approved request (same people who may approve it). */
export async function scheduleRequestAction(id: string, _: FormResult, form: FormData): Promise<FormResult> {
  const ctx = await handlerOf(id);
  const parsed = parseForm(z.object({ scheduledFor: optDate() }), form);
  if (parsed.error) return parsed.error;
  if (!parsed.data.scheduledFor) return { error: "validation", fieldErrors: { scheduledFor: "slotRequired" } };
  try {
    await scheduleRequest(ctx, id, parsed.data.scheduledFor);
  } catch {
    return { error: "requests.notSchedulable" };
  }
  revalidatePath(`/requests/${id}`);
  revalidatePath("/work-orders");
  return { ok: true };
}

export async function declineRequestAction(id: string, _: FormResult, form: FormData): Promise<FormResult> {
  const ctx = await handlerOf(id);
  const reason = z.string().trim().max(1000).parse(form.get("reason") ?? "") || null;
  try {
    await declineRequest(ctx.db, id, reason);
  } catch {
    return { error: "requests.notPending" };
  }
  const req = await ctx.db.request.findUnique({ where: { id } });
  if (req) await notifyRequester(ctx, req, "DECLINED", reason);
  revalidatePath("/requests");
  revalidatePath(`/requests/${id}`);
  return { ok: true };
}

/** Approvers, and the members on call who got the request when it arrived. */
async function handlerOf(id: string) {
  const ctx = await getContext();
  if (ctx.can("requests.approve")) return ctx;
  const mine = await ctx.db.request.count({ where: { id, onCallUsers: { some: { id: ctx.user.id } } } });
  if (ctx.can("internal.view") && mine === 1) return ctx;
  throw new Error("Forbidden");
}
