import "server-only";
import { prisma } from "@/lib/db/client";
import { audit } from "@/lib/audit";
import type { AppContext } from "@/lib/context";
import { createTranslator } from "next-intl";
import en from "../../messages/en.json";
import pt from "../../messages/pt.json";

// Right to erasure (GDPR art. 17). Work history stays (jobs, time, comments are the company's records,
// and deleting them would break reports and invoices), but the person can no longer be identified from
// it: names become a placeholder, contact details and sign-in are removed, personal extras are deleted.

export class ErasureError extends Error {}

/** Placeholder name in the company's default language, with a short tag so two erased people differ. */
export function erasedName(locale: string, kind: "user" | "client", id: string) {
  const t = createTranslator({ locale, messages: locale === "pt" ? pt : en, namespace: "erasure" });
  return `${t(kind === "user" ? "formerUser" : "formerClient")} ${id.slice(-4)}`;
}

/** Erases an ex-member's account. Only for deactivated members who belong to no other company. */
export async function eraseMember(ctx: AppContext, membershipId: string, placeholder: string) {
  const m = await ctx.db.membership.findUnique({ where: { id: membershipId }, include: { user: true } });
  if (!m || m.role === "OWNER" || m.userId === ctx.user.id) throw new ErasureError("forbidden");
  if (m.active) throw new ErasureError("erasure.deactivateFirst");
  if (m.user.erasedAt) return;
  // The account is global; another company's data about this person isn't ours to erase.
  const elsewhere = await prisma.membership.count({ where: { userId: m.userId, organizationId: { not: ctx.organization.id } } });
  if (elsewhere) throw new ErasureError("erasure.otherCompanies");

  const userId = m.userId;
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        name: placeholder,
        email: `erased-${userId}@erased.invalid`,
        phone: null,
        image: null,
        passwordHash: null,
        notificationPrefs: { set: null },
        erasedAt: new Date(),
      },
    }),
    prisma.pushSubscription.deleteMany({ where: { userId } }),
    prisma.notification.deleteMany({ where: { userId } }),
    prisma.teamMember.deleteMany({ where: { userId } }),
    prisma.verificationToken.deleteMany({ where: { identifier: m.user.email } }),
    prisma.invitation.deleteMany({ where: { email: m.user.email, acceptedAt: null } }),
    // Portal requests they made keep the job but lose the typed contact details.
    prisma.request.updateMany({ where: { requesterId: userId }, data: { requesterName: null, requesterEmail: null, requesterPhone: null } }),
  ]);
  await audit(ctx, "user.erased", "User", userId);
}

/** What anonymising a client writes: every field that can identify or reach the person is cleared. */
export function anonymizedClientData(placeholder: string, now = new Date()) {
  return { name: placeholder, email: null, phone: null, taxId: null, billingAddress: null, notes: null, reportEmails: [] as string[], anonymizedAt: now };
}

/** Removes an archived client's contact details and contacts; its villas and jobs stay. */
export async function anonymizeClient(ctx: AppContext, clientId: string, placeholder: string) {
  const client = await ctx.db.client.findFirst({ where: { id: clientId }, include: { portalUsers: { where: { active: true }, select: { id: true } } } });
  if (!client) throw new ErasureError("forbidden");
  if (!client.archivedAt) throw new ErasureError("erasure.archiveFirst");
  if (client.portalUsers.length) throw new ErasureError("erasure.portalUsers");
  if (client.anonymizedAt) return;
  await prisma.$transaction([
    prisma.clientContact.deleteMany({ where: { clientId } }),
    prisma.client.update({
      where: { id: clientId, organizationId: ctx.organization.id },
      data: anonymizedClientData(placeholder),
    }),
  ]);
  await audit(ctx, "client.anonymized", "Client", clientId);
}
