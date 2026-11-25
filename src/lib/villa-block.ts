import "server-only";
import { membersWith, notify } from "@/lib/notify";
import { dayKey } from "@/lib/travel-charge";
import type { WoCtx } from "@/lib/work-orders";

// Blocked villas (Villa.blockedAt, permission villas.block): no work orders can be created for them
// (assertVillaNotBlocked in lib/work-orders.ts). Clients can still send requests; staff can't turn them into work
// orders. A preventive schedule's occurrence on a blocked villa is skipped, and the managers are told by e-mail.

/**
 * Who hears about skipped preventive work orders: the managers (role Manager), else whoever manages preventive
 * maintenance (pm.manage) when the company has no manager.
 */
async function managers(ctx: Pick<WoCtx, "db">) {
  const rows = await ctx.db.membership.findMany({ where: { active: true, role: "MANAGER" }, select: { userId: true } });
  return rows.length ? rows.map((r) => r.userId) : membersWith(ctx.db, "pm.manage");
}

/** PM_BLOCKED: the occurrence `due` of schedule `s` wasn't created because its villa is blocked. */
export async function notifyPreventiveBlocked(ctx: WoCtx, s: { id: string; title: string; villaId: string | null; assetId: string | null }, due: Date) {
  const villaId = s.villaId ?? (s.assetId ? (await ctx.db.asset.findUnique({ where: { id: s.assetId }, select: { villaId: true } }))?.villaId : null);
  const villa = villaId ? await ctx.db.villa.findUnique({ where: { id: villaId }, select: { id: true, name: true } }) : null;
  if (!villa) return;
  // Sent by the system: whoever created the schedule is told too.
  await notify({ organization: ctx.organization, user: null }, await managers(ctx), {
    type: "PM_BLOCKED",
    data: { villa: villa.name, schedule: s.title, due: dayKey(due, ctx.organization.timezone) },
    link: `/villas/${villa.id}`,
  });
}
