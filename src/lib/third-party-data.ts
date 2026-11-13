import "server-only";
import type { AppContext } from "@/lib/context";

// Right of access / portability (GDPR art. 15 and 20) for people without an account: a client (and its contacts),
// or someone who reported a fault on the public QR form. Staff answer the request by downloading this JSON and
// sending it to the person. Access codes and device credentials are never included; work-order internals
// (costs, billing, staff notes) aren't the person's data and stay out too.

const day = (d: Date | null) => (d ? d.toISOString() : null);

export async function exportClientData(ctx: AppContext, clientId: string) {
  const client = await ctx.db.client.findFirst({
    where: { id: clientId },
    select: {
      name: true,
      type: true,
      email: true,
      phone: true,
      taxId: true,
      billingAddress: true,
      notes: true,
      reportEmails: true,
      archivedAt: true,
      createdAt: true,
      contacts: { select: { name: true, role: true, email: true, phone: true, isPrimary: true, receivesReports: true } },
      portalUsers: { select: { active: true, createdAt: true, user: { select: { name: true, email: true, phone: true } } } },
      contracts: { select: { name: true, status: true, startDate: true, endDate: true } },
    },
  });
  if (!client) return null;
  const villas = await ctx.db.villa.findMany({
    where: { OR: [{ clientId }, { managerId: clientId }] },
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true, address: true, city: true, country: true, accessNotes: true, clientId: true, archivedAt: true },
  });
  const villaIds = villas.map((v) => v.id);
  const [workOrders, requests] = await Promise.all([
    ctx.db.workOrder.findMany({
      where: { villaId: { in: villaIds }, clientVisible: true },
      orderBy: [{ year: "asc" }, { number: "asc" }],
      select: {
        year: true,
        number: true,
        title: true,
        status: true,
        createdAt: true,
        completedAt: true,
        workReport: true,
        signedByName: true,
        signedAt: true,
        reportSentAt: true,
        reportSentTo: true,
        villa: { select: { name: true } },
      },
    }),
    ctx.db.request.findMany({
      where: { villaId: { in: villaIds } },
      orderBy: [{ year: "asc" }, { number: "asc" }],
      select: {
        year: true,
        number: true,
        title: true,
        description: true,
        status: true,
        createdAt: true,
        requesterName: true,
        requesterEmail: true,
        requesterPhone: true,
        villa: { select: { name: true } },
        messages: { orderBy: { createdAt: "asc" }, select: { body: true, createdAt: true, user: { select: { name: true } } } },
      },
    }),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    company: ctx.organization.legalName || ctx.organization.name,
    client: { ...client, archivedAt: day(client.archivedAt), createdAt: day(client.createdAt) },
    villas: villas.map(({ clientId: owner, ...v }) => ({ name: v.name, code: v.code, address: v.address, city: v.city, country: v.country, accessNotes: v.accessNotes, relation: owner === clientId ? "owner" : "manager", archivedAt: day(v.archivedAt) })),
    workOrders: workOrders.map(({ villa, ...w }) => ({ ...w, villa: villa?.name ?? null })),
    requests: requests.map(({ villa, messages, ...r }) => ({ ...r, villa: villa?.name ?? null, chat: messages.map((m) => ({ from: m.user.name, at: day(m.createdAt), body: m.body })) })),
  };
}

/** Everything typed on the public QR form under this e-mail address (case-insensitive). */
export async function exportRequesterData(ctx: AppContext, email: string) {
  const requests = await ctx.db.request.findMany({
    where: { requesterId: null, requesterEmail: { equals: email.trim(), mode: "insensitive" } },
    orderBy: [{ year: "asc" }, { number: "asc" }],
    select: {
      year: true,
      number: true,
      title: true,
      description: true,
      status: true,
      declineReason: true,
      createdAt: true,
      requesterName: true,
      requesterEmail: true,
      requesterPhone: true,
      villa: { select: { name: true } },
      attachments: { select: { filename: true, createdAt: true } },
    },
  });
  return {
    exportedAt: new Date().toISOString(),
    company: ctx.organization.legalName || ctx.organization.name,
    email: email.trim(),
    requests: requests.map(({ villa, ...r }) => ({ ...r, villa: villa?.name ?? null })),
  };
}

export function jsonDownload(name: string, data: unknown) {
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
