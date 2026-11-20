import { getContext } from "@/lib/context";
import { audit } from "@/lib/audit";
import { exportSchema, importPlan } from "@/lib/dc-horas-import";
import { dateToDay, dayToDate } from "@/lib/timesheet-rules";

const MAX_BYTES = 15 * 1024 * 1024;

/**
 * Import from the old DC Horas app (org.manage): POST the file from its scripts/export-json.js. Without `apply` it only
 * reports what would happen; with `apply=1` it adds the hours (safe to repeat: identical entries are skipped).
 */
export async function POST(req: Request) {
  const ctx = await getContext();
  if (!ctx.can("org.manage")) return Response.json({ error: "forbidden" }, { status: 403 });
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return Response.json({ error: "noFile" }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "tooBig" }, { status: 400 });
  let parsed;
  try {
    parsed = exportSchema.safeParse(JSON.parse(await file.text()));
  } catch {
    parsed = null;
  }
  if (!parsed?.success) return Response.json({ error: "badFile" }, { status: 400 });

  const [members, villas, existing] = await Promise.all([
    ctx.db.membership.findMany({ where: { role: { not: "REQUESTER" } }, select: { userId: true, user: { select: { email: true } } } }),
    ctx.db.villa.findMany({ select: { id: true, code: true, name: true } }),
    ctx.db.timesheetEntry.findMany({ select: { userId: true, villaId: true, date: true, startTime: true, minutes: true, description: true } }),
  ]);
  const plan = importPlan(
    parsed.data,
    members.map((m) => ({ userId: m.userId, email: m.user.email })),
    villas,
    existing.map((e) => ({ ...e, date: dateToDay(e.date) })),
  );

  let created = 0;
  if (form.get("apply") === "1" && plan.toCreate.length) {
    const orgId = ctx.organization.id;
    for (let i = 0; i < plan.toCreate.length; i += 500) {
      const chunk = plan.toCreate.slice(i, i + 500);
      const r = await ctx.db.timesheetEntry.createMany({ data: chunk.map((e) => ({ ...e, date: dayToDate(e.date), organizationId: orgId })) });
      created += r.count;
    }
    await audit(ctx, "hours.import", "Organization", orgId, { created, file: file.name });
  }
  const { toCreate, ...summary } = plan;
  return Response.json({ ...summary, importable: toCreate.length, created });
}
