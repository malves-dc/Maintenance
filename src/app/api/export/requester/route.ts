import { z } from "zod";
import { getContext } from "@/lib/context";
import { audit } from "@/lib/audit";
import { exportRequesterData, jsonDownload } from "@/lib/third-party-data";

/**
 * What someone typed on the public QR form, found by their e-mail address (GDPR art. 15 and 20). A POST from the
 * form in Settings → Organization, so the address stays out of URLs and server logs.
 */
export async function POST(req: Request) {
  const ctx = await getContext();
  if (!ctx.can("requests.approve")) return new Response("Not found", { status: 404 });
  const email = z.email().safeParse(String((await req.formData()).get("email") ?? "").trim());
  if (!email.success) return new Response("Invalid e-mail address", { status: 400 });
  const data = await exportRequesterData(ctx, email.data);
  await audit(ctx, "requester.export", "Request", "-", { rows: data.requests.length });
  return jsonDownload(`requester-data-${new Date().toISOString().slice(0, 10)}.json`, data);
}
