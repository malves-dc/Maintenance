"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/context";
import { conversationTitle, openConversation, participantIds } from "@/lib/conversations";
import { excerpt, findMentions } from "@/lib/mentions";
import { notify, membersWith } from "@/lib/notify";
import type { FormResult } from "@/lib/forms";

// Chat is for staff; the client portal has no messaging.
const staff = () => requirePermission("internal.view");

export async function startConversationAction(_: FormResult, form: FormData): Promise<FormResult> {
  const ctx = await staff();
  const ids = [...new Set(form.getAll("userIds").map(String).filter((u) => u && u !== ctx.user.id))].slice(0, 50);
  if (ids.length === 0) return { error: "validation", fieldErrors: { userIds: "too_small" } };
  const name = z.string().trim().max(100).parse(form.get("name") ?? "") || null;
  // People with the staff app (not clients, nor people who only log hours).
  const withApp = new Set(await membersWith(ctx.db, "internal.view"));
  const valid = ids.every((id) => withApp.has(id)) ? await ctx.db.membership.count({ where: { userId: { in: ids }, active: true, role: { not: "REQUESTER" } } }) : 0;
  if (valid !== ids.length) return { error: "validation", fieldErrors: { userIds: "invalid" } };

  let id: string;
  if (ids.length === 1 && !name) {
    // One DM per pair of people.
    const existing = await ctx.db.conversation.findFirst({
      where: {
        type: "DIRECT",
        AND: [{ members: { some: { userId: ctx.user.id } } }, { members: { some: { userId: ids[0] } } }, { members: { every: { userId: { in: [ctx.user.id, ids[0]] } } } }],
      },
      select: { id: true },
    });
    id =
      existing?.id ??
      (
        await ctx.db.conversation.create({
          data: { organizationId: ctx.organization.id, type: "DIRECT", members: { create: [{ userId: ctx.user.id, lastReadAt: new Date() }, { userId: ids[0] }] } },
        })
      ).id;
  } else {
    const conv = await ctx.db.conversation.create({
      data: {
        organizationId: ctx.organization.id,
        type: "GROUP",
        name,
        members: { create: [{ userId: ctx.user.id, lastReadAt: new Date() }, ...ids.map((userId) => ({ userId }))] },
      },
    });
    id = conv.id;
  }
  revalidatePath("/messages");
  redirect(`/messages/${id}`);
}

export async function sendMessageAction(conversationId: string, body: string): Promise<{ error?: string }> {
  const ctx = await staff();
  const text = z.string().trim().min(1).max(5000).safeParse(body);
  if (!text.success) return { error: "validation" };
  const conv = await openConversation(ctx, conversationId);
  if (!conv) return { error: "messages.notFound" };

  const now = new Date();
  await ctx.db.message.create({ data: { conversationId, userId: ctx.user.id, body: text.data, createdAt: now } });
  await ctx.db.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: now } });
  await markRead(conversationId, ctx.user.id, now, ctx);

  const people = participantIds(conv);
  const members = await ctx.db.membership.findMany({
    where: { userId: { in: people }, active: true },
    select: { user: { select: { id: true, name: true } } },
  });
  // In a DM the other person gets the message anyway, so an @mention adds nothing.
  const mentioned = conv.type === "DIRECT" ? [] : findMentions(text.data, members.map((m) => m.user));
  const where = conv.type === "DIRECT" ? ctx.user.name : conversationTitle(conv, ctx.user.id);
  const data = { actor: ctx.user.name, excerpt: excerpt(text.data), where };
  const link = `/messages/${conversationId}`;
  await notify(ctx, mentioned, { type: "MENTION", data, link });
  await notify(
    ctx,
    people.filter((u) => !mentioned.includes(u)),
    { type: "MESSAGE", data, link },
  );
  revalidatePath(link);
  return {};
}

async function markRead(conversationId: string, userId: string, at: Date, ctx: Awaited<ReturnType<typeof staff>>) {
  await ctx.db.conversationMember.upsert({
    where: { conversationId_userId: { conversationId, userId } },
    create: { conversationId, userId, lastReadAt: at },
    update: { lastReadAt: at },
  });
}

/** Called by the thread view when it shows new messages. */
export async function markReadAction(conversationId: string) {
  const ctx = await staff();
  const conv = await openConversation(ctx, conversationId);
  if (!conv) return;
  await markRead(conversationId, ctx.user.id, new Date(), ctx);
}

export async function leaveConversationAction(conversationId: string) {
  const ctx = await staff();
  const conv = await openConversation(ctx, conversationId);
  if (!conv || conv.type !== "GROUP") return;
  await ctx.db.conversationMember.deleteMany({ where: { conversationId, userId: ctx.user.id } });
  revalidatePath("/messages");
  redirect("/messages");
}
