"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getContext, requirePermission } from "@/lib/context";
import { optStr, parseForm, type FormResult } from "@/lib/forms";
import { minutesOnDay, timesheetSettings, todayOf, type HoursCtx } from "@/lib/timesheet";
import { checkEntry, dayToDate, parseDuration, timerEntry, withinEditWindow, dateToDay } from "@/lib/timesheet-rules";

// Server actions of the Hours section. Errors are message keys ("hours.errors.<code>").

const err = (code: string): FormResult => ({ error: `hours.errors.${code}` });

async function hoursContext() {
  const ctx = await getContext();
  if (!ctx.can("timesheets.log") && !ctx.can("timesheets.manage")) throw new Error("Forbidden");
  return ctx;
}

/** A villa of this company someone may log hours at (archived ones only when the entry already had it). */
async function villaOk(ctx: HoursCtx, villaId: string, keepId?: string | null) {
  if (!villaId) return false;
  const v = await ctx.db.villa.findFirst({ where: { id: villaId }, select: { archivedAt: true } });
  return !!v && (!v.archivedAt || villaId === keepId);
}

/** Back to where the form was opened from: only paths inside /horas. */
const backTo = (form: FormData) => {
  const next = String(form.get("next") ?? "");
  return /^\/horas(\/[\w/?=&.-]*)?$/.test(next) ? next : "/horas";
};

const entrySchema = z.object({
  userId: optStr(40),
  villaId: z.string().trim().min(1, "villaRequired").max(40),
  date: z.string().trim().min(1).max(10),
  startTime: optStr(5),
  endTime: optStr(5),
  breakMinutes: optStr(4),
  duration: optStr(10),
  description: z.string().trim().min(1).max(4000),
});

/** Adds (entryId null) or changes an hours entry. */
export async function saveEntryAction(entryId: string | null, _: FormResult, form: FormData): Promise<FormResult> {
  const ctx = await hoursContext();
  const manager = ctx.can("timesheets.manage");
  const parsed = parseForm(entrySchema, form);
  if (parsed.error) return parsed.error;
  const d = parsed.data;

  const existing = entryId ? await ctx.db.timesheetEntry.findFirst({ where: { id: entryId } }) : null;
  if (entryId && !existing) return err("notFound");
  if (existing && !manager && existing.userId !== ctx.user.id) return err("notFound");
  const { editDays } = timesheetSettings(ctx.organization);
  const today = todayOf(ctx);
  if (existing && !withinEditWindow(dateToDay(existing.date), today, editDays, manager)) return err("locked");

  // Whose hours: one's own, or anyone's with timesheets.manage (someone who logs hours in this company).
  let userId = existing?.userId ?? ctx.user.id;
  if (manager && d.userId && d.userId !== userId) {
    const m = await ctx.db.membership.findFirst({ where: { userId: d.userId, active: true, role: { not: "REQUESTER" } } });
    if (!m) return err("person");
    userId = d.userId;
  }
  if (!(await villaOk(ctx, d.villaId, existing?.villaId))) return { error: "validation", fieldErrors: { villaId: "villaRequired" } };

  const minutes = d.startTime && d.endTime ? null : parseDuration(d.duration);
  if (!(d.startTime && d.endTime) && d.duration && minutes === null) return { error: "validation", fieldErrors: { duration: "duration" } };
  const checked = checkEntry(
    {
      date: d.date,
      startTime: d.startTime,
      endTime: d.endTime,
      breakMinutes: d.breakMinutes ? Number(d.breakMinutes) : 0,
      minutes,
      description: d.description,
    },
    { today, editDays, manager, otherMinutes: isDayLike(d.date) ? await minutesOnDay(ctx, userId, d.date, existing?.id) : 0 },
  );
  if ("error" in checked) return err(checked.error);
  const e = checked.entry;
  const data = { userId, villaId: d.villaId, date: dayToDate(e.date), startTime: e.startTime, endTime: e.endTime, minutes: e.minutes, description: e.description };
  if (existing) {
    await ctx.db.timesheetEntry.update({ where: { id: existing.id }, data });
  } else {
    await ctx.db.timesheetEntry.create({ data: { ...data, organizationId: ctx.organization.id, createdById: ctx.user.id } });
  }
  revalidatePath("/horas", "layout");
  redirect(backTo(form));
}

const isDayLike = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

export async function deleteEntryAction(entryId: string) {
  const ctx = await hoursContext();
  const manager = ctx.can("timesheets.manage");
  const e = await ctx.db.timesheetEntry.findFirst({ where: { id: entryId } });
  if (!e || (!manager && e.userId !== ctx.user.id)) return;
  const { editDays } = timesheetSettings(ctx.organization);
  if (!withinEditWindow(dateToDay(e.date), todayOf(ctx), editDays, manager)) return;
  await ctx.db.timesheetEntry.delete({ where: { id: e.id } });
  revalidatePath("/horas", "layout");
}

// ── Timer

const startSchema = z.object({ villaId: z.string().trim().min(1, "villaRequired").max(40), description: optStr(4000) });

export async function startTimerAction(_: FormResult, form: FormData): Promise<FormResult> {
  const ctx = await requirePermission("timesheets.log");
  const parsed = parseForm(startSchema, form);
  if (parsed.error) return parsed.error;
  if (!(await villaOk(ctx, parsed.data.villaId))) return { error: "validation", fieldErrors: { villaId: "villaRequired" } };
  if (await ctx.db.timesheetTimer.findFirst({ where: { userId: ctx.user.id } })) return err("timerRunning");
  await ctx.db.timesheetTimer.create({
    data: { organizationId: ctx.organization.id, userId: ctx.user.id, villaId: parsed.data.villaId, startedAt: new Date(), description: parsed.data.description },
  });
  revalidatePath("/horas", "layout");
  return { ok: true };
}

/** Stops the timer and logs the time (a description is needed; without one the timer keeps running). */
export async function stopTimerAction(_: FormResult, form: FormData): Promise<FormResult> {
  const ctx = await requirePermission("timesheets.log");
  const timer = await ctx.db.timesheetTimer.findFirst({ where: { userId: ctx.user.id } });
  if (!timer) return err("noTimer");
  const description = String(form.get("description") ?? "").trim().slice(0, 4000) || timer.description;
  if (!description) return { error: "validation", fieldErrors: { description: "too_small" } };
  const e = timerEntry(timer.startedAt, new Date(), ctx.organization.timezone);
  // Claim the timer first, so a double tap can't log the time twice.
  const { count } = await ctx.db.timesheetTimer.deleteMany({ where: { id: timer.id } });
  if (!count) return err("noTimer");
  if (e) {
    // The day's limit is not enforced here: the time was worked; the team view shows a day over 24 h.
    await ctx.db.timesheetEntry.create({
      data: {
        organizationId: ctx.organization.id,
        userId: ctx.user.id,
        villaId: timer.villaId,
        date: dayToDate(e.date),
        startTime: e.startTime,
        endTime: e.endTime,
        minutes: e.minutes,
        description,
        createdById: ctx.user.id,
      },
    });
  }
  revalidatePath("/horas", "layout");
  return { ok: true };
}

export async function discardTimerAction() {
  const ctx = await requirePermission("timesheets.log");
  await ctx.db.timesheetTimer.deleteMany({ where: { userId: ctx.user.id } });
  revalidatePath("/horas", "layout");
}

// ── Settings

const settingsSchema = z.object({
  editDays: z.coerce.number().int().min(0).max(365),
  dailyHours: z.preprocess((v) => (typeof v === "string" ? v.replace(",", ".") : v), z.coerce.number().gt(0).max(24)),
});

export async function saveHoursSettingsAction(_: FormResult, form: FormData): Promise<FormResult> {
  const ctx = await requirePermission("org.manage");
  const parsed = parseForm(settingsSchema, form);
  if (parsed.error) return parsed.error;
  await ctx.db.organization.update({
    where: { id: ctx.organization.id },
    data: { timesheetEditDays: parsed.data.editDays, timesheetDailyHours: parsed.data.dailyHours },
  });
  revalidatePath("/horas", "layout");
  return { ok: true };
}
