"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/context";
import { auditUser } from "@/lib/audit";
import { checkSecondFactor, clearTwoFactor, enableTwoFactor, replaceRecoveryCodes, twoFactorRequiredFor } from "@/lib/two-factor";

// Two-factor sign-in for the signed-in person: confirm the setup, make new recovery codes, turn it off. Each asks
// for a current code, so a session left open on someone else's computer can't change it.

export type TwoFactorState = { error?: string; codes?: string[] } | undefined;

const codeOf = (form: FormData) => String(form.get("code") ?? "").slice(0, 40);

export async function confirmTwoFactorAction(_: TwoFactorState, form: FormData): Promise<TwoFactorState> {
  const user = await requireUser();
  const codes = await enableTwoFactor(user, codeOf(form));
  if (!codes) return { error: "invalidCode" };
  await auditUser(user.id, "auth.twoFactorEnabled");
  revalidatePath("/", "layout");
  return { codes };
}

export async function newRecoveryCodesAction(_: TwoFactorState, form: FormData): Promise<TwoFactorState> {
  const user = await requireUser();
  if (!user.totpEnabledAt || !(await checkSecondFactor(user, codeOf(form)))) return { error: "invalidCode" };
  const codes = await replaceRecoveryCodes(user.id);
  await auditUser(user.id, "auth.twoFactorCodes");
  return { codes };
}

export async function disableTwoFactorAction(_: TwoFactorState, form: FormData): Promise<TwoFactorState> {
  const user = await requireUser();
  if (await twoFactorRequiredFor(user.id)) return { error: "notAllowed" };
  if (!user.totpEnabledAt || !(await checkSecondFactor(user, codeOf(form)))) return { error: "invalidCode" };
  await clearTwoFactor(user.id);
  await auditUser(user.id, "auth.twoFactorDisabled");
  revalidatePath("/", "layout");
  return {};
}
