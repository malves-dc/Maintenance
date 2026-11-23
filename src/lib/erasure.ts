import "server-only";
import { prisma } from "@/lib/db/client";
import { audit } from "@/lib/audit";
import type { AppContext } from "@/lib/context";
import { deleteObject } from "@/lib/storage";
import { cutoffs, parseRetention } from "@/lib/retention-rules";
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

/**
 * Erases an ex-member. The account is shared by every company the person works for, so:
 *  - if another company still has them (and hasn't erased them), only what this company holds goes: their place in
 *    its teams, its notifications, the contact details on requests they made here; the membership is marked erased
 *    and can't be reactivated. Their name stays on this company's past jobs until the account itself is erased;
 *  - otherwise the account is erased: name, e-mail, phone, password and every company's personal extras.
 */
export async function eraseMember(ctx: AppContext, membershipId: string, placeholder: string): Promise<"account" | "company"> {
  const m = await ctx.db.membership.findUnique({ where: { id: membershipId }, include: { user: true } });
  if (!m || m.role === "OWNER" || m.userId === ctx.user.id) throw new ErasureError("forbidden");
  if (m.active) throw new ErasureError("erasure.deactivateFirst");
  if (m.user.erasedAt) return "account";
  const organizationId = ctx.organization.id;
  const userId = m.userId;
  const now = new Date();
  const elsewhere = await prisma.membership.count({ where: { userId, organizationId: { not: organizationId }, erasedAt: null } });

  if (elsewhere) {
    if (m.erasedAt) return "company";
    await prisma.$transaction([
      prisma.membership.update({ where: { id: m.id }, data: { erasedAt: now, active: false, onCall: false, hourlyRate: null, lastSeenAt: null } }),
      prisma.teamMember.deleteMany({ where: { userId, team: { organizationId } } }),
      prisma.notification.deleteMany({ where: { userId, organizationId } }),
      prisma.invitation.deleteMany({ where: { email: m.user.email, organizationId, acceptedAt: null } }),
      prisma.request.updateMany({ where: { requesterId: userId, organizationId }, data: { requesterName: null, requesterEmail: null, requesterPhone: null } }),
    ]);
    await audit(ctx, "user.erasedHere", "User", userId);
    return "company";
  }

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
        calendarToken: null,
        totpSecretEnc: null,
        totpEnabledAt: null,
        totpLastStep: null,
        totpRecovery: [],
        erasedAt: now,
      },
    }),
    prisma.membership.updateMany({ where: { userId }, data: { erasedAt: now, active: false, onCall: false, hourlyRate: null, lastSeenAt: null } }),
    prisma.pushSubscription.deleteMany({ where: { userId } }),
    prisma.notification.deleteMany({ where: { userId } }),
    prisma.teamMember.deleteMany({ where: { userId } }),
    prisma.verificationToken.deleteMany({ where: { identifier: m.user.email } }),
    prisma.invitation.deleteMany({ where: { email: m.user.email, acceptedAt: null } }),
    // Portal requests they made keep the job but lose the typed contact details.
    prisma.request.updateMany({ where: { requesterId: userId }, data: { requesterName: null, requesterEmail: null, requesterPhone: null } }),
  ]);
  await audit(ctx, "user.erased", "User", userId);
  return "account";
}

/** What anonymising a client writes: every field that can identify or reach the person is cleared. */
export function anonymizedClientData(placeholder: string, now = new Date()) {
  return { name: placeholder, email: null, phone: null, taxId: null, billingAddress: null, notes: null, reportEmails: [] as string[], anonymizedAt: now };
}

/** The client's e-mail addresses (its own, report copies, contacts'), in the forms they may have been stored in. */
export function clientAddresses(client: { email: string | null; reportEmails: string[] }, contacts: { email: string | null }[]) {
  const raw = [client.email, ...client.reportEmails, ...contacts.map((c) => c.email)].filter((e): e is string => !!e?.trim());
  return [...new Set(raw.flatMap((e) => [e.trim(), e.trim().toLowerCase()]))];
}

/** A work order's "report sent to" list without the client's addresses. */
export function withoutAddresses(sentTo: string[], addresses: string[]) {
  const gone = new Set(addresses.map((a) => a.toLowerCase()));
  return sentTo.filter((a) => !gone.has(a.trim().toLowerCase()));
}

/**
 * Removes an archived client's personal data; its villas and jobs stay:
 *  - the client's contact details and contacts;
 *  - its addresses in the "report sent to" lists of past jobs;
 *  - on the villas it owns: the name typed by whoever signed for a job (the signature image stays as proof the work
 *    was accepted, GDPR art. 17(3)(e), but no longer carries a name) and the contact details typed on QR requests;
 *  - on those villas that are archived too: access notes, access codes and photos (files deleted from disk).
 */
export async function anonymizeClient(ctx: AppContext, clientId: string, placeholder: string) {
  const client = await ctx.db.client.findFirst({
    where: { id: clientId },
    include: { portalUsers: { where: { active: true }, select: { id: true } }, contacts: { select: { email: true } } },
  });
  if (!client) throw new ErasureError("forbidden");
  if (!client.archivedAt) throw new ErasureError("erasure.archiveFirst");
  if (client.portalUsers.length) throw new ErasureError("erasure.portalUsers");
  if (client.anonymizedAt) return;
  const organizationId = ctx.organization.id;

  const addresses = clientAddresses(client, client.contacts);
  const sent = addresses.length
    ? await ctx.db.workOrder.findMany({ where: { reportSentTo: { hasSome: addresses } }, select: { id: true, reportSentTo: true } })
    : [];
  const villas = await ctx.db.villa.findMany({ where: { clientId }, select: { id: true, archivedAt: true } });
  const villaIds = villas.map((v) => v.id);
  const closedIds = villas.filter((v) => v.archivedAt).map((v) => v.id);
  const photos = closedIds.length ? await ctx.db.attachment.findMany({ where: { villaId: { in: closedIds } }, select: { id: true, url: true } }) : [];

  await prisma.$transaction([
    prisma.clientContact.deleteMany({ where: { clientId } }),
    prisma.client.update({ where: { id: clientId, organizationId }, data: anonymizedClientData(placeholder) }),
    ...sent.map((w) => prisma.workOrder.update({ where: { id: w.id, organizationId }, data: { reportSentTo: withoutAddresses(w.reportSentTo, addresses) } })),
    prisma.workOrder.updateMany({ where: { organizationId, villaId: { in: villaIds }, signedByName: { not: null } }, data: { signedByName: placeholder } }),
    prisma.request.updateMany({
      where: { organizationId, villaId: { in: villaIds }, requesterId: null },
      data: { requesterName: null, requesterEmail: null, requesterPhone: null },
    }),
    prisma.villa.updateMany({ where: { organizationId, id: { in: closedIds } }, data: { accessNotes: null, secretsEnc: null } }),
    prisma.attachment.deleteMany({ where: { organizationId, id: { in: photos.map((p) => p.id) } } }),
  ]);
  await Promise.all(photos.map((p) => deleteObject(p.url).catch(() => undefined)));
  await audit(ctx, "client.anonymized", "Client", clientId, { villas: closedIds.length, photos: photos.length });
}

/** Former members and archived clients past the company's reminder period, still to be reviewed for erasure. */
export async function erasureDue(ctx: AppContext) {
  const before = cutoffs(parseRetention(ctx.organization.retention), new Date()).former;
  if (!before) return { members: 0, clients: 0 };
  const [members, clients] = await Promise.all([
    ctx.db.membership.count({ where: { active: false, erasedAt: null, deactivatedAt: { lt: before }, role: { not: "OWNER" }, user: { erasedAt: null } } }),
    ctx.db.client.count({ where: { archivedAt: { lt: before }, anonymizedAt: null } }),
  ]);
  return { members, clients };
}
