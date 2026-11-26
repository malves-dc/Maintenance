import type { Role } from "@/generated/prisma/enums";
import type { Permission } from "@/lib/rbac";

/**
 * Whether a member must sign in with a second factor. The person's own setting wins (Settings → Staff / Clients:
 * required or not required, `own`); otherwise the company's rule: when it requires it (Settings → Organization), for
 * the Super Admin and admins, and for anyone who can open villa access codes and device credentials.
 */
export function needsTwoFactor(require2fa: boolean, role: Role, permissions: ReadonlySet<Permission>, own: boolean | null = null) {
  if (own !== null) return own;
  return require2fa && (role === "OWNER" || role === "ADMIN" || permissions.has("secrets.view"));
}

/** A member's own two-factor setting, as the Staff / Clients pages offer it. */
export const TWO_FACTOR_SETTINGS = ["company", "required", "notRequired"] as const;
export type TwoFactorSetting = (typeof TWO_FACTOR_SETTINGS)[number];
export const twoFactorSettingOf = (own: boolean | null): TwoFactorSetting => (own === null ? "company" : own ? "required" : "notRequired");
export const twoFactorOwnOf = (s: TwoFactorSetting): boolean | null => (s === "company" ? null : s === "required");
