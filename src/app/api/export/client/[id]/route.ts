import { getContext } from "@/lib/context";
import { audit } from "@/lib/audit";
import { exportClientData, jsonDownload } from "@/lib/third-party-data";

/** A client's personal data as JSON, to answer an access / portability request (GDPR art. 15 and 20). */
export async function GET(_: Request, { params }: RouteContext<"/api/export/client/[id]">) {
  const ctx = await getContext();
  if (!ctx.can("clients.manage")) return new Response("Not found", { status: 404 });
  const { id } = await params;
  const data = await exportClientData(ctx, id);
  if (!data) return new Response("Not found", { status: 404 });
  await audit(ctx, "client.export", "Client", id);
  return jsonDownload(`client-data-${new Date().toISOString().slice(0, 10)}.json`, data);
}
