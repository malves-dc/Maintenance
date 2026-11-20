import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/client";
import { tenantDb } from "@/lib/db/tenant";
import { requestIp } from "@/lib/audit";
import { effectivePermissions, type Permission } from "@/lib/rbac";
import { needsTwoFactor } from "@/lib/two-factor-rules";
import { hourlyRateFor, parseRoleRates } from "@/lib/roles";
import { touchLastSeen } from "@/lib/online-users";

export const ACTIVE_ORG_COOKIE = "active_org";

/** Signed-in user or redirect to /login. */
export const requireUser = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  // A valid cookie for an account that is gone (backup restored, factory reset) or erased: clear it, or
  // proxy.ts and this redirect would bounce between /login and the app forever.
  if (!user || user.erasedAt) redirect("/session/clear");
  return user;
});

/**
 * Resolves user + active organization + membership for the current request.
 * The active org comes from a cookie and falls back to the user's first membership;
 * users with no organization are sent to onboarding.
 */
export const getContext = cache(async () => {
  const user = await requireUser();
  const memberships = await prisma.membership.findMany({
    where: { userId: user.id, active: true },
    include: { organization: true, jobRole: true },
    orderBy: { createdAt: "asc" },
  });
  if (memberships.length === 0) redirect("/onboarding");

  const wanted = (await cookies()).get(ACTIVE_ORG_COOKIE)?.value;
  const membership = memberships.find((m) => m.organizationId === wanted) ?? memberships[0];
  await touchLastSeen(membership);
  // The company's permission settings (Settings → Roles) applied to this member's role / custom role.
  const permissions = effectivePermissions(membership.role, membership.organization.rolePermissions, membership.jobRole?.permissions);
  // Admins and people who can open access codes must have two-factor sign-in on first (Settings → Organization).
  if (!user.totpEnabledAt && needsTwoFactor(membership.organization.require2fa, membership.role, permissions)) redirect("/two-factor");

  return {
    user,
    membership,
    organization: membership.organization,
    memberships,
    role: membership.role,
    /** Cost per hour of this member's time (from their role); null when not set or not billable. */
    hourlyRate: hourlyRateFor(membership, parseRoleRates(membership.organization.roleRates)),
    db: tenantDb(membership.organizationId, { userId: user.id, ip: await requestIp() }),
    permissions,
    can: (p: Permission) => permissions.has(p),
  };
});

export type AppContext = Awaited<ReturnType<typeof getContext>>;

/** Context guaranteed to hold `permission`; throws otherwise (server actions) . */
export async function requirePermission(permission: Permission) {
  const ctx = await getContext();
  if (!ctx.can(permission)) throw new Error("Forbidden");
  return ctx;
}

/** For changing permissions (Settings → Roles): only the Super Admin (role OWNER). */
export async function requireOwner() {
  const ctx = await getContext();
  if (ctx.role !== "OWNER") throw new Error("Forbidden");
  return ctx;
}
