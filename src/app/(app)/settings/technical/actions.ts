"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/context";
import { prisma } from "@/lib/db/client";
import { audit, changesOf } from "@/lib/audit";
import { parseForm, type FormResult } from "@/lib/forms";
import { CHECK_INTERVALS } from "@/lib/connectivity-rules";

const technicalSchema = z.object({
  connectivityIntervalSec: z.coerce
    .number()
    .int()
    .refine((v) => v === 0 || (CHECK_INTERVALS as readonly number[]).includes(v)),
});

export async function updateTechnicalAction(_: FormResult, form: FormData): Promise<FormResult> {
  const ctx = await requirePermission("org.manage");
  const parsed = parseForm(technicalSchema, form);
  if (parsed.error) return parsed.error;
  // Organization isn't a tenant-scoped model; scope by id explicitly.
  await prisma.organization.update({ where: { id: ctx.organization.id }, data: parsed.data });
  const { changes } = changesOf(ctx.organization as unknown as Record<string, unknown>, parsed.data);
  if (Object.keys(changes).length) await audit(ctx, "organization.technical", "Organization", ctx.organization.id, { changes });
  revalidatePath("/settings/technical");
  return { ok: true };
}
