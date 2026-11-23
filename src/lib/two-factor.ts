import "server-only";
import QRCode from "qrcode";
import { prisma } from "@/lib/db/client";
import { decryptField, encryptField } from "@/lib/crypto";
import { effectivePermissions } from "@/lib/rbac";
import { needsTwoFactor } from "@/lib/two-factor-rules";
import { hashRecovery, isRecoveryCode, newRecoveryCodes, newTotpSecret, otpauthUrl, verifyTotp } from "@/lib/totp";

// Two-factor sign-in (GDPR art. 32): the TOTP secret is stored with encryptField. It is decrypted only to check a
// code at sign-in or in the setup / profile forms, each of which is itself audit-logged (auth.*), so the decrypt
// isn't logged separately.

type TotpUser = { id: string; totpSecretEnc: string | null; totpLastStep: number | null; totpRecovery: string[] };

/**
 * Checks a code from the app, or a recovery code (used up). Returns how the person passed, or null.
 * Writes are conditional, so the same code can't be used twice by two requests at once.
 */
export async function checkSecondFactor(user: TotpUser, code: string): Promise<"totp" | "recovery" | null> {
  if (!user.totpSecretEnc || !code.trim()) return null;
  if (isRecoveryCode(code)) {
    const h = hashRecovery(code);
    if (!user.totpRecovery.includes(h)) return null;
    const r = await prisma.user.updateMany({ where: { id: user.id, totpRecovery: { has: h } }, data: { totpRecovery: user.totpRecovery.filter((x) => x !== h) } });
    return r.count ? "recovery" : null;
  }
  const step = verifyTotp(decryptField(user.totpSecretEnc), code, Date.now(), user.totpLastStep);
  if (step === null) return null;
  const r = await prisma.user.updateMany({ where: { id: user.id, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] }, data: { totpLastStep: step } });
  return r.count ? "totp" : null;
}

/** Whether any company the person is active in requires them to use two-factor sign-in. */
export async function twoFactorRequiredFor(userId: string) {
  const memberships = await prisma.membership.findMany({
    where: { userId, active: true },
    select: { role: true, organization: { select: { require2fa: true, rolePermissions: true } }, jobRole: { select: { permissions: true } } },
  });
  return memberships.some((m) => needsTwoFactor(m.organization.require2fa, m.role, effectivePermissions(m.role, m.organization.rolePermissions, m.jobRole?.permissions)));
}

/** The secret being set up (made on first visit to the setup page, kept until confirmed so a reload doesn't change it). */
export async function pendingSetup(user: { id: string; email: string; totpSecretEnc: string | null }, issuer: string) {
  let secret = user.totpSecretEnc ? decryptField(user.totpSecretEnc) : null;
  if (!secret) {
    secret = newTotpSecret();
    await prisma.user.update({ where: { id: user.id }, data: { totpSecretEnc: encryptField(secret), totpEnabledAt: null, totpLastStep: null } });
  }
  const url = otpauthUrl(issuer, user.email, secret);
  const qr = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  return { secret, qr };
}

/** Turns two-factor on with a confirmed code; returns the recovery codes to show once. */
export async function enableTwoFactor(user: TotpUser & { totpEnabledAt: Date | null }, code: string) {
  if (user.totpEnabledAt || !user.totpSecretEnc) return null;
  const step = verifyTotp(decryptField(user.totpSecretEnc), code);
  if (step === null) return null;
  const codes = newRecoveryCodes();
  await prisma.user.update({ where: { id: user.id }, data: { totpEnabledAt: new Date(), totpLastStep: step, totpRecovery: codes.map(hashRecovery) } });
  return codes;
}

/** New recovery codes (the old ones stop working). */
export async function replaceRecoveryCodes(userId: string) {
  const codes = newRecoveryCodes();
  await prisma.user.update({ where: { id: userId }, data: { totpRecovery: codes.map(hashRecovery) } });
  return codes;
}

export async function clearTwoFactor(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { totpSecretEnc: null, totpEnabledAt: null, totpLastStep: null, totpRecovery: [] } });
}
