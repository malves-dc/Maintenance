"use server";

import { getContext } from "@/lib/context";
import { postRequestMessage, RequestChatError } from "@/lib/request-chat";

/**
 * Adds a message to a request's chat. Shared by the staff app, the field app and the client portal, so it
 * can't hang on one permission: postRequestMessage() checks that the user takes part (lib/request-chat-rules.ts).
 * There is no action to edit or delete a message: the chat is a permanent record.
 */
export async function sendRequestMessageAction(requestId: string, body: string): Promise<{ error?: string }> {
  const ctx = await getContext();
  try {
    await postRequestMessage(ctx, String(requestId), String(body ?? ""));
    return {};
  } catch (e) {
    if (e instanceof RequestChatError) return { error: e.message };
    throw e;
  }
}
