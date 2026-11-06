import "server-only";
import type { AppContext } from "@/lib/context";
import { membersWith, notify } from "@/lib/notify";
import { excerpt } from "@/lib/mentions";
import { mayChat, REQUEST_MESSAGE_MAX, type ChatPayload, type ChatViewer } from "@/lib/request-chat-rules";
import { docRef } from "@/lib/series";

// The chat on a support request (RequestMessage). It belongs to the request and is shown on the request
// (staff and portal) and on the work order it became (web and field app). Messages are only ever added:
// there is deliberately no function here, nor any action or API, that edits or deletes one.

/** How many of the latest messages are loaded. */
const SHOWN = 500;

type Lookup = { requestId: string } | { workOrderId: string };

async function findRequest(ctx: AppContext, by: Lookup) {
  return ctx.db.request.findFirst({
    where: "requestId" in by ? { id: by.requestId } : { workOrderId: by.workOrderId },
    select: {
      id: true,
      year: true, number: true,
      title: true,
      requesterId: true,
      villa: { select: { name: true, clientId: true, managerId: true } },
      workOrder: { select: { id: true, assignees: { select: { userId: true } } } },
    },
  });
}

type Found = NonNullable<Awaited<ReturnType<typeof findRequest>>>;

function viewerOf(ctx: AppContext): ChatViewer {
  const portal = ctx.role === "REQUESTER";
  return { userId: ctx.user.id, portal, clientId: ctx.membership.clientId, canManage: !portal && ctx.can("requests.chat") };
}

const assigneeIds = (r: Found) => r.workOrder?.assignees.map((a) => a.userId) ?? [];
const allowed = (ctx: AppContext, r: Found) => mayChat(viewerOf(ctx), { requesterId: r.requesterId, villa: r.villa, assigneeIds: assigneeIds(r) });

/** The request's chat for the current user, or null when there is no such request or they may not take part. */
export async function openRequestChat(ctx: AppContext, by: Lookup): Promise<ChatPayload | null> {
  const r = await findRequest(ctx, by);
  if (!r || !allowed(ctx, r)) return null;
  const rows = await ctx.db.requestMessage.findMany({
    where: { requestId: r.id },
    select: { id: true, body: true, createdAt: true, fromClient: true, userId: true, user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: SHOWN,
  });
  return {
    requestId: r.id,
    number: docRef(r),
    messages: rows.reverse().map((m) => ({
      id: m.id,
      body: m.body,
      at: m.createdAt.toISOString(),
      author: m.user.name,
      fromClient: m.fromClient,
      mine: m.userId === ctx.user.id,
    })),
  };
}

export class RequestChatError extends Error {}

/** Adds a message (the only write there is). Error codes are message keys. */
export async function postRequestMessage(ctx: AppContext, requestId: string, text: string) {
  const body = text.trim();
  if (!body) throw new RequestChatError("requestChat.emptyMessage");
  if (body.length > REQUEST_MESSAGE_MAX) throw new RequestChatError("requestChat.tooLong");
  const r = await findRequest(ctx, { requestId });
  if (!r || !allowed(ctx, r)) throw new RequestChatError("requestChat.forbidden");

  const fromClient = ctx.role === "REQUESTER";
  await ctx.db.requestMessage.create({
    data: { organizationId: ctx.organization.id, requestId: r.id, userId: ctx.user.id, fromClient, body },
  });
  await notifyParticipants(ctx, r, body);
}

/** Tells the other participants, each with a link to where they see the chat. */
async function notifyParticipants(ctx: AppContext, r: Found, body: string) {
  const clientIds = [r.villa?.clientId, r.villa?.managerId].filter((x): x is string => !!x);
  const [portalUsers, managers] = await Promise.all([
    clientIds.length
      ? ctx.db.membership.findMany({ where: { active: true, role: "REQUESTER", clientId: { in: clientIds } }, select: { userId: true } })
      : [],
    membersWith(ctx.db, "requests.chat", { excludeRoles: ["REQUESTER"] }),
  ]);
  const portal = new Set([...(r.requesterId ? [r.requesterId] : []), ...portalUsers.map((m) => m.userId)]);
  const staff = new Set(managers.filter((id) => !portal.has(id)));
  const technicians = assigneeIds(r).filter((id) => !portal.has(id) && !staff.has(id));
  const data = { number: docRef(r), title: r.title, actor: ctx.user.name, excerpt: excerpt(body, 140) };
  await notify(ctx, [...portal], { type: "REQUEST_MESSAGE", data, link: `/portal/requests/${r.id}` });
  await notify(ctx, [...staff], { type: "REQUEST_MESSAGE", data, link: `/requests/${r.id}` });
  if (r.workOrder) await notify(ctx, technicians, { type: "REQUEST_MESSAGE", data, link: `/work-orders/${r.workOrder.id}` });
}
