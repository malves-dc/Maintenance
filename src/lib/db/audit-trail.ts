import "server-only";
import { prisma } from "./client";
import { changesOf, plain, writeAudit, type AuditActor } from "@/lib/audit";
import type { Prisma } from "@/generated/prisma/client";

// Automatic audit trail: every create / update / delete of the main records made through a company's
// tenant client (ctx.db) is logged with who, when, from where and — for updates — each changed field's old
// and new value. Ledgers that are already a history (stock movements, time entries, comments,
// notifications) aren't repeated here.

/** Audited models; "delete" = only deletions (adding photos is everyday work, removing one is worth knowing). */
export const AUDITED: Record<string, "all" | "delete"> = {
  Client: "all",
  Villa: "all",
  Area: "all",
  Asset: "all",
  ServiceContract: "all",
  Procedure: "all",
  Category: "all",
  WorkOrder: "all",
  Request: "all",
  PMSchedule: "all",
  Meter: "all",
  Part: "all",
  StockLocation: "all",
  Vendor: "all",
  PurchaseOrder: "all",
  Team: "all",
  JobRole: "all",
  Membership: "all",
  Invitation: "all",
  KnowledgeArticle: "all",
  OnCallWeek: "all",
  Attachment: "delete",
};

const WRITES = new Set(["create", "createMany", "createManyAndReturn", "update", "updateMany", "updateManyAndReturn", "upsert", "delete", "deleteMany"]);
const MAX_ROWS = 50;

/** "WorkOrder" → "workOrder": the action prefix and the Prisma delegate name. */
export const entityKey = (model: string) => model[0].toLowerCase() + model.slice(1);

type Row = Record<string, unknown>;

/** A readable name for the entry, kept in meta so it still reads after the record is gone. */
async function labelOf(model: string, row: Row | null | undefined): Promise<string | null> {
  if (!row) return null;
  if (model === "Membership" && typeof row.userId === "string") {
    const u = await prisma.user.findUnique({ where: { id: row.userId }, select: { name: true, email: true } }).catch(() => null);
    return u ? `${u.name} <${u.email}>` : null;
  }
  if (model === "OnCallWeek" && row.weekStart instanceof Date && typeof row.userId === "string") {
    const u = await prisma.user.findUnique({ where: { id: row.userId }, select: { name: true } }).catch(() => null);
    return [row.weekStart.toISOString().slice(0, 10), u?.name].filter(Boolean).join(" · ");
  }
  const number = row.number == null ? null : row.year != null ? `${row.year}-${row.number}` : `#${row.number}`; // work orders and requests go by year
  const name = (row.title ?? row.name ?? row.email ?? row.filename ?? null) as string | null;
  return [number, name].filter(Boolean).join(" ") || null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const delegate = (model: string) => (prisma as any)[entityKey(model)] as { findFirst: (a: object) => Promise<Row | null>; findMany: (a: object) => Promise<Row[]> };

type Args = { where?: object; data?: Row | Row[]; create?: Row; update?: Row };

const isObj = (v: unknown): v is Row => !!v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date);
const list = (v: unknown) => (Array.isArray(v) ? v : v === undefined ? [] : [v]) as Row[];

/**
 * The ids a relation write leaves in place, when it replaces the whole relation: { set: [{ id }] } or
 * { deleteMany: {}, create: [{ userId }] } (how forms save assignees, categories…). Null for partial writes.
 */
function replacedIds(op: unknown): { key: string; ids: string[] } | null {
  if (!isObj(op)) return null;
  if (Array.isArray(op.set)) return { key: "id", ids: op.set.map((x) => String((x as Row).id)) };
  if (isObj(op.deleteMany) && Object.keys(op.deleteMany).length === 0) {
    const items = list(op.create);
    // Only join rows ({ userId }, assignees also keep their role on the job), not records with their own fields (checklist items…).
    const keysOf = (i: Row) => Object.keys(i).filter((k) => k !== "role" && k !== "jobRoleId");
    if (items.some((i) => keysOf(i).length !== 1)) return null;
    const key = items.length ? keysOf(items[0])[0] : "id";
    if (!key.endsWith("Id") && key !== "id") return null;
    return { key, ids: items.map((i) => String(i[key])) };
  }
  return null;
}

/** Names for related ids (people, categories, assets), else the ids themselves. */
async function namesOf(relation: string, key: string, ids: string[]) {
  if (!ids.length) return [];
  const rows: { id: string; name: string }[] =
    key === "userId"
      ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }).catch(() => [])
      : relation === "categories"
        ? await prisma.category.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }).catch(() => [])
        : relation === "assets"
          ? await prisma.asset.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }).catch(() => [])
          : [];
  const byId = new Map(rows.map((r) => [r.id, r.name]));
  return ids.map((id) => byId.get(id) ?? id).sort((a, b) => a.localeCompare(b));
}

/**
 * Turns relation writes into before → after lists where the write replaces the relation and the stored rows
 * are known; unchanged ones are dropped. The rest stay as "linked items changed".
 */
async function relationChanges(before: Row, data: Row, relations: string[]) {
  const changes: Record<string, [unknown, unknown]> = {};
  const unknown: string[] = [];
  for (const rel of relations) {
    const next = replacedIds(data[rel]);
    const rows = before[rel];
    if (!next || !Array.isArray(rows)) {
      unknown.push(rel);
      continue;
    }
    // Emptied with { deleteMany: {} } alone: name the old rows by their person / category.
    if (next.ids.length === 0 && rows.length && next.key === "id") next.key = ["userId", "categoryId"].find((k) => k in (rows[0] as Row)) ?? "id";
    const was = rows.map((r) => String((r as Row)[next.key]));
    if (was.length === next.ids.length && was.every((id) => next.ids.includes(id))) continue;
    changes[rel] = [await namesOf(rel, next.key, was), await namesOf(rel, next.key, next.ids)];
  }
  return { changes, unknown };
}

/** Runs `query` and logs what it did. Logging never fails the write. */
export async function withAuditTrail(
  organizationId: string,
  actor: AuditActor,
  model: string,
  operation: string,
  args: Args,
  query: (a: Args) => Promise<unknown>,
) {
  const mode = AUDITED[model];
  if (!mode || !WRITES.has(operation) || (mode === "delete" && !operation.startsWith("delete"))) return query(args);

  const many = operation.endsWith("Many") || operation.endsWith("ManyAndReturn");
  const writeData = ((operation === "upsert" ? args.update : args.data) ?? {}) as Row;
  // Relations the update rewrites are loaded too, so the entry can say what they were.
  const relationKeys = operation.startsWith("update") || operation === "upsert" ? changesOf(null, writeData).relations : [];
  let before: Row[] = [];
  if (!operation.startsWith("create")) {
    const include = relationKeys.length ? { include: Object.fromEntries(relationKeys.map((k) => [k, true])) } : {};
    try {
      before = many
        ? await delegate(model).findMany({ where: args.where, take: MAX_ROWS })
        : ([await delegate(model).findFirst({ where: args.where, ...include }).catch(() => delegate(model).findFirst({ where: args.where }))].filter(Boolean) as Row[]);
    } catch {
      before = [];
    }
  }

  const result = await query(args);

  try {
    const key = entityKey(model);
    const log = (action: string, id: string, meta: Prisma.InputJsonValue) =>
      writeAudit({ organizationId, userId: actor.userId, action, entityType: model, entityId: id, meta, ip: actor.ip });

    if (operation === "create" || (operation === "upsert" && before.length === 0)) {
      const data = (operation === "upsert" ? args.create : args.data) as Row;
      const row = { ...data, ...((result as Row) ?? {}) };
      await log(`${key}.create`, String(row.id ?? "?"), { label: await labelOf(model, row) });
    } else if (operation.startsWith("createMany")) {
      const count = Array.isArray(args.data) ? args.data.length : 1;
      await log(`${key}.create`, "-", { count });
    } else if (operation.startsWith("update") || operation === "upsert") {
      for (const row of before) {
        const scalar = changesOf(row, writeData);
        const rel = await relationChanges(row, writeData, scalar.relations);
        const changes = { ...scalar.changes, ...rel.changes };
        const relations = rel.unknown;
        if (Object.keys(changes).length === 0 && relations.length === 0) continue;
        const meta: Record<string, unknown> = { label: await labelOf(model, { ...row, ...(result && !many ? (result as Row) : {}) }), changes };
        if (relations.length) meta.relations = relations;
        await log(`${key}.update`, String(row.id), meta as Prisma.InputJsonValue);
      }
    } else if (operation.startsWith("delete")) {
      for (const row of before) {
        await log(`${key}.delete`, String(row.id), { label: await labelOf(model, row), ...(model === "WorkOrder" ? { status: plain(row.status) } : {}) } as Prisma.InputJsonValue);
      }
    }
  } catch (e) {
    console.error("[audit] trail failed", model, operation, e);
  }
  return result;
}
