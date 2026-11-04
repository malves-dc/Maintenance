import { revalidatePath } from "next/cache";
import { z, ZodError } from "zod";
import { getContext } from "@/lib/context";
import { changeStatus, myRateOn, WorkOrderError } from "@/lib/work-orders";
import { addComment, addTimeEntry, answerItem, clampAt, setClientAbsent, setWorkReport, signOff, WORK_REPORT_MAX } from "@/lib/wo-ops";
import { enumOf } from "@/lib/forms";
import { WorkOrderStatus } from "@/generated/prisma/enums";
import type { SyncResult } from "@/lib/offline-types";

const MAX_OPS = 200;
const id = z.string().min(8).max(64);
const base = { id, woId: z.string().min(1).max(40), at: z.string().max(40) };
const opSchema = z.discriminatedUnion("kind", [
  z.object({ ...base, kind: z.literal("answer"), itemId: z.string().min(1).max(40), value: z.string().max(5000).nullable(), note: z.string().max(2000).nullish() }),
  z.object({ ...base, kind: z.literal("comment"), body: z.string().max(5000) }),
  z.object({ ...base, kind: z.literal("time"), startedAt: z.string().max(40), endedAt: z.string().max(40), note: z.string().max(500).nullish(), mode: z.enum(["ONSITE", "REMOTE"]).optional() }),
  z.object({ ...base, kind: z.literal("status"), status: enumOf(WorkOrderStatus), note: z.string().max(1000).nullish() }),
  z.object({ ...base, kind: z.literal("signoff"), name: z.string().max(150), attachmentId: z.string().min(1).max(40) }),
  z.object({ ...base, kind: z.literal("clientAbsent"), absent: z.boolean() }),
  z.object({ ...base, kind: z.literal("report"), text: z.string().max(WORK_REPORT_MAX) }),
]);

/**
 * Applies the field app's queued changes in order. Each op id is claimed first, so a retried batch
 * never applies anything twice. Business-rule failures come back as "rejected" with a message key;
 * unexpected errors stop the batch with "retry" so ordering is preserved.
 */
export async function POST(req: Request) {
  const ctx = await getContext();
  if (!ctx.can("workOrders.execute")) return Response.json({ error: "forbidden" }, { status: 403 });
  const parsed = z.object({ ops: z.array(z.unknown()).max(MAX_OPS) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "badRequest" }, { status: 400 });

  const results: SyncResult[] = [];
  const touched = new Set<string>();
  for (const raw of parsed.data.ops) {
    const op = opSchema.safeParse(raw);
    const opId = typeof (raw as { id?: unknown })?.id === "string" ? (raw as { id: string }).id : "";
    if (!op.success) {
      results.push({ id: opId, status: "rejected", error: "validation" });
      continue;
    }
    const o = op.data;

    // Claim the id; a replay returns what happened the first time.
    try {
      await ctx.db.syncOperation.create({ data: { id: o.id, organizationId: ctx.organization.id, userId: ctx.user.id, kind: o.kind, status: "pending" } });
    } catch {
      const prior = await ctx.db.syncOperation.findFirst({ where: { id: o.id, userId: ctx.user.id } });
      if (!prior) results.push({ id: o.id, status: "rejected", error: "validation" });
      else if (prior.status === "pending") {
        results.push({ id: o.id, status: "retry" });
        break;
      } else results.push({ id: o.id, status: prior.status as SyncResult["status"], error: prior.error ?? undefined });
      continue;
    }

    let result: SyncResult;
    try {
      if (o.kind === "answer") {
        const r = await answerItem(ctx, o.woId, o.itemId, o.value, o.note, clampAt(o.at));
        result = { id: o.id, status: r };
      } else if (o.kind === "comment") {
        await addComment(ctx, o.woId, o.body, [], clampAt(o.at));
        result = { id: o.id, status: "applied" };
      } else if (o.kind === "time") {
        await addTimeEntry(ctx, o.woId, await myRateOn(ctx, o.woId), clampAt(o.startedAt), clampAt(o.endedAt), o.note ?? null, o.mode ?? "ONSITE");
        result = { id: o.id, status: "applied" };
      } else if (o.kind === "signoff") {
        await signOff(ctx, o.woId, o.name, o.attachmentId, clampAt(o.at));
        result = { id: o.id, status: "applied" };
      } else if (o.kind === "clientAbsent") {
        await setClientAbsent(ctx, o.woId, o.absent);
        result = { id: o.id, status: "applied" };
      } else if (o.kind === "report") {
        await setWorkReport(ctx, o.woId, o.text);
        result = { id: o.id, status: "applied" };
      } else {
        await changeStatus(ctx, o.woId, o.status, o.note ?? null);
        result = { id: o.id, status: "applied" };
      }
    } catch (e) {
      if (e instanceof WorkOrderError) result = { id: o.id, status: "rejected", error: `wo.${e.code}` };
      else if (e instanceof ZodError) result = { id: o.id, status: "rejected", error: "validation" };
      else {
        console.error("[offline sync]", e);
        await ctx.db.syncOperation.deleteMany({ where: { id: o.id } }); // let the device retry it
        results.push({ id: o.id, status: "retry" });
        break;
      }
    }
    await ctx.db.syncOperation.update({ where: { id: o.id }, data: { status: result.status, error: result.error ?? null } });
    results.push(result);
    touched.add(o.woId);
  }

  for (const woId of touched) revalidatePath(`/work-orders/${woId}`);
  return Response.json({ results }, { headers: { "Cache-Control": "private, no-store" } });
}
