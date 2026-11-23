import "server-only";
import type { AppContext } from "@/lib/context";
import { notify } from "@/lib/notify";
import { excerpt } from "@/lib/mentions";
import { effectivePermissions } from "@/lib/rbac";
import {
  chatParticipants,
  mayChat,
  REQUEST_MESSAGE_MAX,
  type ChatParticipant,
  type ChatPayload,
  type ChatViewer,
  type ParticipantKind,
} from "@/lib/request-chat-rules";
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
  const [rows, participants] = await Promise.all([
    ctx.db.requestMessage.findMany({
      where: { requestId: r.id },
      select: { id: true, body: true, createdAt: true, fromClient: true, userId: true, user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: SHOWN,
    }),
    participantsOf(ctx, r),
  ]);
  return {
    requestId: r.id,
    number: docRef(r),
    participants: participants.map((p) => ({ ...p, mine: p.userId === ctx.user.id })),
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

/**
 * Everyone who can read and write the chat. Candidates are the client side (the requester and the portal users
 * of the villa's owner and property manager) and all active staff; chatParticipants() keeps only those mayChat()
 * lets in, so this list and the access check can't drift apart.
 */
async function participantsOf(ctx: AppContext, r: Found): Promise<ChatParticipant[]> {
  const clientIds = [r.villa?.clientId, r.villa?.managerId].filter((x): x is string => !!x);
  const rows = await ctx.db.membership.findMany({
    where: {
      active: true,
      OR: [
        { role: { not: "REQUESTER" } },
        ...(r.requesterId ? [{ userId: r.requesterId }] : []),
        ...(clientIds.length ? [{ role: "REQUESTER" as const, clientId: { in: clientIds } }] : []),
      ],
    },
    select: {
      userId: true, role: true, clientId: true,
      user: { select: { name: true } },
      jobRole: { select: { permissions: true } },
      organization: { select: { rolePermissions: true } },
    },
  });
  const candidates = rows.map((m) => {
    const portal = m.role === "REQUESTER";
    const canManage = !portal && effectivePermissions(m.role, m.organization.rolePermissions, m.jobRole?.permissions).has("requests.chat");
    return { userId: m.userId, name: m.user.name, portal, clientId: m.clientId, canManage };
  });
  return chatParticipants(candidates, { requesterId: r.requesterId, villa: r.villa, assigneeIds: assigneeIds(r) });
}

/** Tells the other participants, each with a link to where they see the chat. */
async function notifyParticipants(ctx: AppContext, r: Found, body: string) {
  const others = (await participantsOf(ctx, r)).filter((p) => p.userId !== ctx.user.id);
  const ids = (kind: ParticipantKind) => others.filter((p) => p.kind === kind).map((p) => p.userId);
  const data = { number: docRef(r), title: r.title, actor: ctx.user.name, excerpt: excerpt(body, 140) };
  await notify(ctx, ids("client"), { type: "REQUEST_MESSAGE", data, link: `/portal/requests/${r.id}` });
  await notify(ctx, ids("staff"), { type: "REQUEST_MESSAGE", data, link: `/requests/${r.id}` });
  if (r.workOrder) await notify(ctx, ids("technician"), { type: "REQUEST_MESSAGE", data, link: `/work-orders/${r.workOrder.id}` });
}
