import "server-only";
import { prisma } from "@/lib/db/client";

// Invitations are read with the raw client: the person accepting isn't a member of the company yet.

/** A pending (not accepted, not expired) invitation by its token. */
export async function pendingInvitation(token: string) {
  const invite = await prisma.invitation.findUnique({ where: { token }, include: { organization: true, jobRole: { select: { name: true } } } });
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) return null;
  return invite;
}

/** The newest pending invitation for an e-mail address, if any. */
export async function pendingInvitationFor(email: string) {
  return prisma.invitation.findFirst({
    where: { email: email.toLowerCase(), acceptedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { token: true },
  });
}

/** Makes the user a member of the invitation's company and marks it accepted. Returns the company id, or null
 *  when the invitation isn't pending or was sent to another address. */
export async function acceptInvitation(userId: string, token: string) {
  const inv = await pendingInvitation(token);
  if (!inv) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user || user.email.toLowerCase() !== inv.email.toLowerCase()) return null;
  await prisma.$transaction([
    prisma.membership.upsert({
      where: { userId_organizationId: { userId, organizationId: inv.organizationId } },
      create: { userId, organizationId: inv.organizationId, role: inv.role, jobRoleId: inv.jobRoleId, clientId: inv.clientId },
      update: { role: inv.role, jobRoleId: inv.jobRoleId, clientId: inv.clientId, active: true },
    }),
    prisma.invitation.update({ where: { id: inv.id }, data: { acceptedAt: new Date() } }),
  ]);
  return inv.organizationId;
}
