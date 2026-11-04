import { getContext } from "@/lib/context";
import { ACTIVE_STATUSES } from "@/lib/work-orders";
import type { Snapshot } from "@/lib/offline-types";
import { ARTICLE_LIST_SELECT, listedArticle } from "@/lib/knowledge-select";

const MAX_WORK_ORDERS = 50;
const COMMENTS = 20;
const MAX_ARTICLES = 500;

/**
 * What a technician needs offline: their open work orders with checklists, recent comments, the
 * villa's access notes (never the encrypted codes) and the assets at those villas (for QR scans).
 */
export async function GET() {
  const ctx = await getContext();
  if (!ctx.can("workOrders.execute")) return Response.json({ error: "forbidden" }, { status: 403 });

  const wos = await ctx.db.workOrder.findMany({
    where: { status: { in: ACTIVE_STATUSES }, assignees: { some: { userId: ctx.user.id } } },
    include: {
      villa: { select: { id: true, name: true, address: true, city: true, accessNotes: true } },
      area: { select: { name: true } },
      asset: { select: { id: true, name: true, manufacturer: true, model: true, serialNumber: true } },
      items: { orderBy: { sortOrder: "asc" }, include: { completedBy: { select: { name: true } } } },
      comments: { orderBy: { createdAt: "desc" }, take: COMMENTS, include: { user: { select: { name: true } } } },
      timeEntries: { where: { minutes: { not: null } }, select: { minutes: true } },
    },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { priority: "desc" }, { number: "asc" }],
    take: MAX_WORK_ORDERS,
  });
  const villaIds = [...new Set(wos.map((w) => w.villa?.id).filter((x): x is string => !!x))];
  const [assets, members, articles] = await Promise.all([
    ctx.db.asset.findMany({ where: { villaId: { in: villaIds }, archivedAt: null }, select: { id: true, name: true, qrToken: true, villa: { select: { name: true } } } }),
    ctx.db.membership.findMany({ where: { active: true, role: { not: "REQUESTER" } }, select: { user: { select: { id: true, name: true } } } }),
    // The villas' knowledge base (text; files need a connection). Staff only, like the rest of the app.
    ctx.can("internal.view")
      ? ctx.db.knowledgeArticle.findMany({ where: { villaId: { in: villaIds } }, select: { ...ARTICLE_LIST_SELECT, villaId: true }, take: MAX_ARTICLES })
      : [],
  ]);

  const body: Snapshot = {
    at: new Date().toISOString(),
    user: { id: ctx.user.id, name: ctx.user.name },
    workOrders: wos.map((w) => ({
      id: w.id,
      number: w.number,
      title: w.title,
      description: w.description,
      status: w.status,
      priority: w.priority,
      type: w.type,
      dueDate: w.dueDate?.toISOString() ?? null,
      startDate: w.startDate?.toISOString() ?? null,
      villa: w.villa && { id: w.villa.id, name: w.villa.name, address: w.villa.address, city: w.villa.city, accessNotes: w.villa.accessNotes },
      area: w.area?.name ?? null,
      asset: w.asset && {
        id: w.asset.id,
        name: w.asset.name,
        details: [[w.asset.manufacturer, w.asset.model].filter(Boolean).join(" "), w.asset.serialNumber && `S/N ${w.asset.serialNumber}`].filter(Boolean).join(" · ") || null,
      },
      items: w.items.map((i) => ({
        id: i.id,
        type: i.type,
        label: i.label,
        description: i.description,
        required: i.required,
        options: i.options,
        unit: i.unit,
        value: i.value,
        note: i.note,
        completedBy: i.completedBy?.name ?? null,
      })),
      comments: w.comments.reverse().map((c) => ({ id: c.id, user: c.user.name, body: c.body, at: c.createdAt.toISOString() })),
      minutesLogged: w.timeEntries.reduce((s, e) => s + (e.minutes ?? 0), 0),
      signOff: w.signatureUrl && w.signedByName && w.signedAt ? { name: w.signedByName, at: w.signedAt.toISOString() } : null,
      clientAbsent: w.clientAbsent,
      workReport: w.workReport,
    })),
    assets: assets.map((a) => ({ id: a.id, name: a.name, qrToken: a.qrToken, villa: a.villa.name })),
    members: members.map((m) => m.user),
    knowledge: articles.map((a) => ({ ...listedArticle(a), villaId: a.villaId, updatedAt: a.updatedAt.toISOString(), updatedBy: a.updatedBy?.name ?? null, files: a._count.attachments })),
  };
  return Response.json(body, { headers: { "Cache-Control": "private, no-store" } });
}
