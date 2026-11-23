import "server-only";
import { prisma } from "@/lib/db/client";
import { cutoffs, daysBefore, EXPIRED_INVITE_DAYS, parseRetention, PUSH_IDLE_DAYS, SYNC_LOG_DAYS } from "@/lib/retention-rules";
import { deleteObject } from "@/lib/storage";
import { NO_OWNER } from "@/lib/uploads";

/** An article image is kept this long without its article being saved (someone may still be writing it). */
const DRAFT_IMAGE_DAYS = 2;

// Daily clean-up that applies each company's retention periods (lib/retention-rules.ts). A background
// job, so it uses the raw client and scopes every query by organizationId itself.

export async function runRetention(now = new Date()) {
  const totals = { notifications: 0, audit: 0, requesters: 0, chat: 0, sync: 0, tokens: 0, invites: 0, draftImages: 0, push: 0 };
  const orgs = await prisma.organization.findMany({ select: { id: true, retention: true } });
  for (const org of orgs) {
    const c = cutoffs(parseRetention(org.retention), now);
    const organizationId = org.id;
    if (c.notifications) totals.notifications += (await prisma.notification.deleteMany({ where: { organizationId, createdAt: { lt: c.notifications } } })).count;
    if (c.audit) totals.audit += (await prisma.auditLog.deleteMany({ where: { organizationId, createdAt: { lt: c.audit } } })).count;
    if (c.requesters) {
      // Anonymous QR requests only (portal requests belong to a user account); pending ones are still needed.
      const r = await prisma.request.updateMany({
        where: {
          organizationId,
          requesterId: null,
          status: { not: "PENDING" },
          updatedAt: { lt: c.requesters },
          OR: [{ requesterName: { not: null } }, { requesterEmail: { not: null } }, { requesterPhone: { not: null } }],
        },
        data: { requesterName: null, requesterEmail: null, requesterPhone: null },
      });
      totals.requesters += r.count;
    }
    if (c.chat) totals.chat += (await prisma.message.deleteMany({ where: { conversation: { organizationId }, createdAt: { lt: c.chat } } })).count;
  }
  totals.sync = (await prisma.syncOperation.deleteMany({ where: { createdAt: { lt: daysBefore(now, SYNC_LOG_DAYS) } } })).count;
  totals.tokens = (await prisma.verificationToken.deleteMany({ where: { expires: { lt: now } } })).count;
  totals.invites = (await prisma.invitation.deleteMany({ where: { acceptedAt: null, expiresAt: { lt: daysBefore(now, EXPIRED_INVITE_DAYS) } } })).count;
  // Push devices of people with no access left, or who haven't opened the app (signed in, or used it in any company)
  // for PUSH_IDLE_DAYS. A device registered recently is kept whatever the user's history.
  const idle = daysBefore(now, PUSH_IDLE_DAYS);
  totals.push = (
    await prisma.pushSubscription.deleteMany({
      where: {
        createdAt: { lt: idle },
        user: {
          OR: [
            { memberships: { none: { active: true } } },
            { OR: [{ lastSignInAt: null }, { lastSignInAt: { lt: idle } }], memberships: { none: { lastSeenAt: { gte: idle } } } },
          ],
        },
      },
    })
  ).count;
  // Images uploaded into a knowledge article that was never saved (lib/uploads.ts → draftForVillaId).
  const drafts = await prisma.attachment.findMany({ where: { ...NO_OWNER, createdAt: { lt: daysBefore(now, DRAFT_IMAGE_DAYS) } }, select: { id: true, url: true } });
  if (drafts.length) {
    await prisma.attachment.deleteMany({ where: { id: { in: drafts.map((d) => d.id) } } });
    await Promise.all(drafts.map((d) => deleteObject(d.url).catch(() => undefined)));
  }
  totals.draftImages = drafts.length;
  return totals;
}
