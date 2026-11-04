import type { NextRequest } from "next/server";
import { getContext } from "@/lib/context";
import { openRequestChat } from "@/lib/request-chat";

/**
 * A request's chat for the current user (polled by <RequestChat>): `?requestId=` or `?workOrderId=` (the
 * request the job came from). 404 when there is none or the user doesn't take part. Read-only.
 */
export async function GET(req: NextRequest) {
  const ctx = await getContext();
  const requestId = req.nextUrl.searchParams.get("requestId");
  const workOrderId = req.nextUrl.searchParams.get("workOrderId");
  const chat = requestId ? await openRequestChat(ctx, { requestId }) : workOrderId ? await openRequestChat(ctx, { workOrderId }) : null;
  if (!chat) return Response.json({ error: "notFound" }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  return Response.json(chat, { headers: { "Cache-Control": "private, no-store" } });
}
