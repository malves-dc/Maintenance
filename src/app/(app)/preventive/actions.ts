"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission, type AppContext } from "@/lib/context";
import { assertOwned } from "@/lib/db/tenant";
import { enumOf, optEnumOf, optId, optNumber, optStr, parseForm, str, type FormResult } from "@/lib/forms";
import { generateWorkOrder, initialNextDue, MAX_LEAD_DAYS, recurrenceOf, runDueSchedules } from "@/lib/pm";
import { nextOccurrence } from "@/lib/pm-schedule";
import { assertVillaNotBlocked, validateAssignees, WorkOrderError } from "@/lib/work-orders";
import { Frequency, PMTrigger, Priority, SystemType } from "@/generated/prisma/enums";

const isoDate = () => z.preprocess((v) => (v ? v : undefined), z.coerce.date().optional()).transform((v) => v ?? null);

const pmSchema = z.object({
  title: str(200),
  description: optStr(5000),
  procedureId: optId(),
  villaId: optId(),
  assetId: optId(),
  teamId: optId(),
  system: optEnumOf(SystemType),
  priority: enumOf(Priority),
  estimatedHours: optNumber().refine((v) => v === null || (v >= 0 && v <= 1000)),
  trigger: enumOf(PMTrigger),
  frequency: optEnumOf(Frequency),
  interval: z.coerce.number().int().min(1).max(365).default(1),
  startDate: isoDate(),
  endDate: isoDate(),
  leadDays: z.coerce.number().int().min(0).max(MAX_LEAD_DAYS).default(0),
  meterId: optId(),
  meterInterval: optNumber().refine((v) => v === null || v > 0),
});

/** Next due date that can't collide with an occurrence already generated for this schedule. */
async function safeNextDue(ctx: AppContext, scheduleId: string | null, s: Parameters<typeof initialNextDue>[0]) {
  const tz = ctx.organization.timezone;
  const r = recurrenceOf(s, tz);
  if (!r) return null;
  const last = scheduleId
    ? await ctx.db.workOrder.findFirst({ where: { pmScheduleId: scheduleId, dueDate: { not: null } }, orderBy: { dueDate: "desc" }, select: { dueDate: true } })
    : null;
  const now = new Date();
  const floor = last?.dueDate && last.dueDate > now ? last.dueDate : null;
  return floor ? nextOccurrence(r, floor) : initialNextDue(s, tz, now);
}

export async function savePMAction(id: string | null, _: FormResult, form: FormData): Promise<FormResult> {
  const ctx = await requirePermission("pm.manage");
  const parsed = parseForm(pmSchema, form);
  if (parsed.error) return parsed.error;
  const { estimatedHours, ...d } = parsed.data;
  const daysOfWeek = form.getAll("daysOfWeek").map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);

  // Trigger-specific requirements.
  if (d.trigger === "TIME") {
    const fieldErrors: Record<string, string> = {};
    if (!d.frequency) fieldErrors.frequency = "too_small";
    if (!d.startDate) fieldErrors.startDate = "too_small";
    if (d.endDate && d.startDate && d.endDate <= d.startDate) fieldErrors.endDate = "invalid";
    if (Object.keys(fieldErrors).length) return { error: "validation", fieldErrors };
  } else {
    const fieldErrors: Record<string, string> = {};
    if (!d.meterId) fieldErrors.meterId = "too_small";
    if (!d.meterInterval) fieldErrors.meterInterval = "too_small";
    if (Object.keys(fieldErrors).length) return { error: "validation", fieldErrors };
  }

  try {
    await assertOwned(ctx.db, "procedure", [d.procedureId]);
    await assertOwned(ctx.db, "team", [d.teamId]);
    let { villaId, assetId, system } = d;
    if (d.trigger === "METER") {
      const meter = await ctx.db.meter.findUnique({ where: { id: d.meterId! }, select: { assetId: true } });
      if (!meter) return { error: "validation", fieldErrors: { meterId: "invalid" } };
      assetId = meter.assetId;
    }
    if (assetId) {
      const asset = await ctx.db.asset.findUnique({ where: { id: assetId }, select: { villaId: true, system: true } });
      if (!asset || (villaId && asset.villaId !== villaId)) throw new WorkOrderError("invalidRef");
      villaId = asset.villaId;
      system = system ?? asset.system;
    } else if (villaId) {
      await assertOwned(ctx.db, "villa", [villaId]);
    }
    const assigneeIds = await validateAssignees(ctx, form.getAll("assigneeIds").map(String).filter(Boolean));

    const data = {
      title: d.title,
      description: d.description,
      procedureId: d.procedureId,
      teamId: d.teamId,
      villaId,
      assetId,
      system,
      priority: d.priority,
      estimatedMinutes: estimatedHours === null ? null : Math.round(estimatedHours * 60),
      trigger: d.trigger,
      leadDays: d.leadDays,
      ...(d.trigger === "TIME"
        ? { frequency: d.frequency, interval: d.interval, daysOfWeek: d.frequency === "WEEKLY" ? daysOfWeek : [], startDate: d.startDate, endDate: d.endDate, meterId: null, meterInterval: null }
        : { frequency: null, daysOfWeek: [], startDate: null, endDate: null, meterId: d.meterId, meterInterval: d.meterInterval }),
    };
    const nextDueAt = d.trigger === "TIME" ? await safeNextDue(ctx, id, data as Parameters<typeof initialNextDue>[0]) : null;

    let pmId = id;
    if (id) {
      const before = await ctx.db.pMSchedule.findUnique({ where: { id }, select: { meterId: true } });
      if (!before) return { error: "somethingWrong" };
      await ctx.db.pMSchedule.update({
        where: { id },
        data: {
          ...data,
          nextDueAt,
          // A different meter means a new baseline.
          ...(before.meterId !== data.meterId ? { lastMeterValue: null } : {}),
          assignees: { deleteMany: {}, create: assigneeIds.map((userId) => ({ userId })) },
        },
      });
    } else {
      pmId = (
        await ctx.db.pMSchedule.create({
          data: {
            ...data,
            organizationId: ctx.organization.id,
            createdById: ctx.user.id,
            nextDueAt,
            assignees: { create: assigneeIds.map((userId) => ({ userId })) },
          },
        })
      ).id;
    }
    // Meter schedules take the current reading as their baseline.
    if (data.trigger === "METER") {
      const m = await ctx.db.meter.findUnique({ where: { id: data.meterId! }, select: { lastValue: true } });
      await ctx.db.pMSchedule.updateMany({ where: { id: pmId!, lastMeterValue: null }, data: { lastMeterValue: m?.lastValue ?? null } });
    }
    // Something may already be due (e.g. start date today with lead time).
    await runDueSchedules({ organizationId: ctx.organization.id });
    revalidatePath("/preventive");
    redirect(`/preventive/${pmId}`);
  } catch (e) {
    if (e instanceof WorkOrderError) return { error: `wo.${e.code}` };
    throw e;
  }
}

export async function setPMActiveAction(id: string, active: boolean) {
  const ctx = await requirePermission("pm.manage");
  const s = await ctx.db.pMSchedule.findUnique({ where: { id } });
  if (!s) throw new Error("Not found");
  const nextDueAt = active && s.trigger === "TIME" ? await safeNextDue(ctx, id, s) : s.nextDueAt;
  await ctx.db.pMSchedule.update({ where: { id }, data: { active, nextDueAt } });
  revalidatePath("/preventive");
  revalidatePath(`/preventive/${id}`);
}

/** Creates the next occurrence's work order now (e.g. the client asked to bring it forward). */
export async function generateNowAction(id: string) {
  const ctx = await requirePermission("pm.manage");
  const s = await ctx.db.pMSchedule.findUnique({ where: { id }, include: { assignees: { select: { userId: true } } } });
  if (!s) throw new Error("Not found");
  // A blocked villa takes no work orders (lib/villa-block.ts): say so before the occurrence is used up.
  const villaId = s.villaId ?? (s.assetId ? (await ctx.db.asset.findUnique({ where: { id: s.assetId }, select: { villaId: true } }))?.villaId ?? null : null);
  try {
    await assertVillaNotBlocked(ctx, villaId);
  } catch (e) {
    if (e instanceof WorkOrderError) return { error: `wo.${e.code}` };
    throw e;
  }
  const r = recurrenceOf(s, ctx.organization.timezone);
  const due = s.trigger === "TIME" && s.nextDueAt ? s.nextDueAt : new Date();
  if (s.trigger === "TIME" && r && s.nextDueAt) {
    const claimed = await ctx.db.pMSchedule.updateMany({
      where: { id, nextDueAt: s.nextDueAt },
      data: { nextDueAt: nextOccurrence(r, s.nextDueAt), lastGeneratedAt: new Date() },
    });
    if (claimed.count !== 1) return;
  }
  const wo = await generateWorkOrder(ctx, s, due);
  revalidatePath(`/preventive/${id}`);
  redirect(`/work-orders/${wo.id}`);
}

export async function deletePMAction(id: string) {
  const ctx = await requirePermission("pm.manage");
  await ctx.db.pMSchedule.delete({ where: { id } }); // generated WOs keep existing (pmScheduleId → null)
  revalidatePath("/preventive");
  redirect("/preventive");
}

export async function runSchedulerNowAction() {
  const ctx = await requirePermission("pm.manage");
  const res = await runDueSchedules({ organizationId: ctx.organization.id });
  revalidatePath("/preventive");
  revalidatePath("/work-orders");
  return res;
}
