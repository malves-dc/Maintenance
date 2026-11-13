"use server";

import bcrypt from "bcryptjs";
import { AuthError, CredentialsSignin } from "next-auth";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { auth, signIn, signOut } from "@/auth";
import { prisma } from "@/lib/db/client";
import { createOrganization } from "@/lib/org";
import { ACTIVE_ORG_COOKIE, requireUser } from "@/lib/context";
import { appLocale, isLocale, LOCALE_COOKIE } from "@/i18n/config";
import { isTheme, THEME_COOKIE } from "@/lib/theme";
import { createTranslator } from "next-intl";
import en from "../../../messages/en.json";
import pt from "../../../messages/pt.json";
import { appOrigin } from "@/lib/qr";
import { getAppName } from "@/lib/server-settings";
import { signupAllowed, signupOpen } from "@/lib/signup";
import { emailLayout, sendEmail } from "@/lib/email";
import { background } from "@/lib/notify";
import { clearResetTokens, createResetToken, userForResetToken } from "@/lib/password-reset";
import { auditUser, writeAudit } from "@/lib/audit";
import { clearLastSeen } from "@/lib/online-users";
import { checkFactoryResetPassword, factoryReset, factoryResetBlocked, factoryResetEnabled, recordFactoryResetFailure } from "@/lib/factory-reset";

export type FormState = { error?: string } | undefined;

function safeNext(next: FormDataEntryValue | null) {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/dashboard";
}

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      code: form.get("code") ?? "",
      redirectTo: safeNext(form.get("next")),
    });
  } catch (e) {
    if (e instanceof CredentialsSignin && e.code === "too_many_attempts") return { error: "tooManyAttempts" };
    if (e instanceof CredentialsSignin && e.code === "two_factor_required") return { error: "twoFactorRequired" };
    if (e instanceof CredentialsSignin && e.code === "two_factor_invalid") return { error: "twoFactorInvalid" };
    if (e instanceof AuthError) return { error: "invalidCredentials" };
    throw e; // NEXT_REDIRECT on success
  }
}

const signupSchema = z.object({
  name: z.string().trim().min(1).max(100),
  company: z.string().trim().max(100).optional(),
  email: z.email().transform((e) => e.toLowerCase().trim()),
  password: z.string().min(8).max(200),
  next: z.string().optional(),
});

/** Creates a user. With a company name it also creates their organization (owner sign-up);
 *  without one (invitation flow) the user joins via the invite page afterwards. */
export async function signupAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "passwordRule" };
  const { name, company, email, password, next } = parsed.data;
  if (!(await signupAllowed({ email, company, next }))) return { error: "signupClosed" };

  if (await prisma.user.findUnique({ where: { email } })) return { error: "emailTaken" };

  const locale = appLocale(await getLocale());
  const user = await prisma.user.create({
    data: { name, email, passwordHash: await bcrypt.hash(password, 12), locale },
  });
  if (company) {
    const org = await createOrganization(user.id, company, locale);
    (await cookies()).set(ACTIVE_ORG_COOKIE, org.id, { path: "/", httpOnly: true, sameSite: "lax" });
  }

  await signIn("credentials", { email, password, redirectTo: safeNext(form.get("next")) });
}

export async function createOrgAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!(await signupOpen())) return { error: "signupClosed" };
  const name = z.string().trim().min(1).max(100).safeParse(form.get("company"));
  if (!name.success) return { error: "somethingWrong" };
  const org = await createOrganization(user.id, name.data, isLocale(user.locale) ? user.locale : "en");
  (await cookies()).set(ACTIVE_ORG_COOKIE, org.id, { path: "/", httpOnly: true, sameSite: "lax" });
  redirect("/dashboard");
}

// ── Password reset

/** Always answers the same way, so it can't be used to find out which emails have accounts. */
export async function requestResetAction(_: FormState, form: FormData): Promise<FormState & { sent?: boolean }> {
  const email = z.email().safeParse(String(form.get("email") ?? "").toLowerCase().trim());
  if (!email.success) return { error: "invalidEmail" };
  const user = await prisma.user.findUnique({ where: { email: email.data } });
  if (user) {
    await auditUser(user.id, "auth.passwordResetRequested");
    const raw = await createResetToken(user.id);
    if (raw) {
      const url = `${await appOrigin()}/reset-password/${raw}`;
      const t = createTranslator({ locale: user.locale, messages: user.locale === "pt" ? pt : en, namespace: "email" });
      const mail = emailLayout({ org: await getAppName(), heading: t("resetSubject"), paragraphs: [t("resetBody")], cta: { label: t("resetCta"), url } });
      background(() => sendEmail({ to: user.email, subject: t("resetSubject"), ...mail }));
    }
  }
  return { sent: true };
}

const resetSchema = z.object({ token: z.string().min(10).max(100), password: z.string().min(8).max(200), confirm: z.string() });

export async function resetPasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = resetSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "passwordRule" };
  if (parsed.data.password !== parsed.data.confirm) return { error: "passwordMismatch" };
  const user = await userForResetToken(parsed.data.token);
  if (!user) return { error: "resetExpired" };
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(parsed.data.password, 12) } });
  await clearResetTokens(user.id);
  await auditUser(user.id, "auth.passwordReset");
  redirect("/login?reset=1");
}

export async function signOutAction() {
  const session = await auth();
  if (session?.user?.id) {
    await auditUser(session.user.id, "auth.signOut");
    await clearLastSeen(session.user.id);
  }
  await signOut({ redirectTo: "/login" });
}

export async function setLocaleAction(locale: string) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  const session = await auth();
  if (session?.user?.id) await prisma.user.update({ where: { id: session.user.id }, data: { locale } });
}

export async function switchOrgAction(organizationId: string) {
  const user = await requireUser();
  const m = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId: user.id, organizationId } },
  });
  if (!m?.active) return;
  (await cookies()).set(ACTIVE_ORG_COOKIE, organizationId, { path: "/", httpOnly: true, sameSite: "lax" });
  redirect("/dashboard");
}

// ── Factory reset (demo/test servers; see src/lib/factory-reset.ts)

/** A server-wide event with no signed-in user (the factory reset page is public). */
async function auditEveryCompany(action: string, client: string) {
  const ip = client === "unknown" ? null : client;
  for (const o of await prisma.organization.findMany({ select: { id: true } })) {
    await writeAudit({ organizationId: o.id, userId: null, action, entityType: "Server", entityId: "-", ip });
  }
}

export async function factoryResetAction(_: FormState, form: FormData): Promise<FormState> {
  if (!factoryResetEnabled()) return { error: "somethingWrong" };
  const h = await headers();
  const client = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  if (factoryResetBlocked(client)) return { error: "tooManyAttempts" };
  const password = form.get("password");
  if (typeof password !== "string" || !checkFactoryResetPassword(password)) {
    recordFactoryResetFailure(client);
    await auditEveryCompany("server.factoryResetFailed", client);
    return { error: "wrongResetPassword" };
  }
  console.warn(`[factory-reset] requested from ${client}`);
  await factoryReset();
  // Everything was erased: the entry goes into the recreated companies' (empty) logs.
  await auditEveryCompany("server.factoryReset", client);
  (await cookies()).delete(ACTIVE_ORG_COOKIE);
  await signOut({ redirectTo: "/login?factory=1" }); // the signed-in user no longer exists
}

// ── Appearance

/** Saves the theme on every change: to the user when signed in, and in a cookie for signed-out pages. */
export async function setThemeAction(theme: string) {
  if (!isTheme(theme)) return;
  (await cookies()).set(THEME_COOKIE, theme, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  const session = await auth();
  if (session?.user?.id) await prisma.user.update({ where: { id: session.user.id }, data: { theme } });
}
