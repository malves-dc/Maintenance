import { z } from "zod";
import { DAY_MINUTES, isDay, TIME_RE } from "@/lib/timesheet-rules";

// Import from the old DC Horas app (its scripts/export-json.js): people are matched by e-mail to this company's
// members, obras by code (else by name) to villas. Pure: the plan is worked out here and tested; the route applies it.

const user = z.object({ id: z.number(), name: z.string(), email: z.string().nullable().optional() });
const obra = z.object({ id: z.number(), code: z.string(), name: z.string() });
const entry = z.object({
  id: z.number(),
  user_id: z.number(),
  obra_id: z.number(),
  date: z.string(),
  start_time: z.string().nullable().optional(),
  end_time: z.string().nullable().optional(),
  minutes: z.number(),
  description: z.string().nullable().optional(),
  created_by: z.number().nullable().optional(),
});
export const exportSchema = z.object({ format: z.literal("dc-horas-export"), users: z.array(user), obras: z.array(obra), entries: z.array(entry) });
export type DcHorasExport = z.infer<typeof exportSchema>;

export type Member = { userId: string; email: string };
export type VillaRef = { id: string; code: string | null; name: string };
export type Existing = { userId: string; villaId: string; date: string; startTime: string | null; minutes: number; description: string };

export type NewEntry = Existing & { endTime: string | null; createdById: string };

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
const key = (e: Existing) => [e.userId, e.villaId, e.date, e.startTime ?? "", e.minutes, e.description.trim()].join("|");

export function importPlan(data: DcHorasExport, members: Member[], villas: VillaRef[], existing: Existing[]) {
  const byEmail = new Map(members.map((m) => [norm(m.email), m.userId]));
  const userMap = new Map<number, string>();
  const missingUsers: { name: string; email: string | null; entries: number }[] = [];
  const count = (pick: (e: DcHorasExport["entries"][number]) => number, id: number) => data.entries.filter((e) => pick(e) === id).length;
  for (const u of data.users) {
    const id = byEmail.get(norm(u.email));
    if (id) userMap.set(u.id, id);
    else missingUsers.push({ name: u.name, email: u.email ?? null, entries: count((e) => e.user_id, u.id) });
  }
  const villaMap = new Map<number, string>();
  const missingObras: { code: string; name: string; entries: number }[] = [];
  for (const o of data.obras) {
    const v = villas.find((x) => x.code && norm(x.code) === norm(o.code)) ?? villas.find((x) => norm(x.name) === norm(o.name));
    if (v) villaMap.set(o.id, v.id);
    else missingObras.push({ code: o.code, name: o.name, entries: count((e) => e.obra_id, o.id) });
  }

  const seen = new Set(existing.map(key));
  const toCreate: NewEntry[] = [];
  let skippedUnmatched = 0;
  let duplicates = 0;
  let invalid = 0;
  for (const e of data.entries) {
    const userId = userMap.get(e.user_id);
    const villaId = villaMap.get(e.obra_id);
    if (!userId || !villaId) {
      skippedUnmatched++;
      continue;
    }
    const startTime = e.start_time && TIME_RE.test(e.start_time) ? e.start_time : null;
    const endTime = startTime && e.end_time && TIME_RE.test(e.end_time) ? e.end_time : null;
    const minutes = Math.round(e.minutes);
    const description = (e.description ?? "").trim().slice(0, 4000) || "—";
    if (!isDay(e.date) || !(minutes > 0 && minutes <= DAY_MINUTES)) {
      invalid++;
      continue;
    }
    const row: NewEntry = { userId, villaId, date: e.date, startTime, endTime, minutes, description, createdById: (e.created_by && userMap.get(e.created_by)) || userId };
    const k = key(row);
    if (seen.has(k)) {
      duplicates++;
      continue;
    }
    seen.add(k);
    toCreate.push(row);
  }
  return {
    matchedUsers: userMap.size,
    missingUsers: missingUsers.filter((u) => u.entries > 0 || u.email),
    matchedObras: villaMap.size,
    missingObras,
    toCreate,
    skippedUnmatched,
    duplicates,
    invalid,
  };
}

export type ImportPlan = ReturnType<typeof importPlan>;
