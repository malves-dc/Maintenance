import type { Role } from "@/generated/prisma/enums";
import type { Permission } from "@/lib/rbac";

/**
 * Whether a member must sign in with a second factor: when the company requires it (Settings → Organization), for
 * the Super Admin and admins, and for anyone who can open villa access codes and device credentials.
 */
export function needsTwoFactor(require2fa: boolean, role: Role, permissions: ReadonlySet<Permission>) {
  return require2fa && (role === "OWNER" || role === "ADMIN" || permissions.has("secrets.view"));
}
