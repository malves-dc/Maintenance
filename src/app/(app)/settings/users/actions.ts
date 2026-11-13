"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/context";
import { prisma } from "@/lib/db/client";
import { parseForm, str, type FormResult } from "@/lib/forms";
import { audit } from "@/lib/audit";

const nameSchema = z.object({ name: str(100) });

/**
 * Renames a member of this company (staff or client portal user), from Settings → Staff / Clients.
 * The account is global, so the new name shows in every company the person belongs to; the membership
 * lookup through `ctx.db` keeps it to people of the current company. Erased accounts keep their placeholder,
 * and only the Super Admin renames a Super Admin.
 */
export async function renameMemberAction(membershipId: string, _: FormResult, form: FormData): Promise<FormResult> {
  const ctx = await requirePermission("users.manage");
  const parsed = parseForm(nameSchema, form);
  if (parsed.error) return parsed.error;
  const m = await ctx.db.membership.findUnique({ where: { id: membershipId }, select: { role: true, userId: true, user: { select: { name: true, erasedAt: true } } } });
  if (!m || m.user.erasedAt || (m.role === "OWNER" && ctx.role !== "OWNER")) return { error: "somethingWrong" };
  const name = parsed.data.name;
  if (name !== m.user.name) {
    // User isn't a tenant model: the membership above is the company check.
    await prisma.user.update({ where: { id: m.userId }, data: { name } });
    await audit(ctx, "user.rename", "User", m.userId, { changes: { name: [m.user.name, name] } });
  }
  revalidatePath("/settings/users");
  revalidatePath("/settings/client-users");
  return { ok: true };
}
