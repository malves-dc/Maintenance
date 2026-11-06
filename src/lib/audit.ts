import "server-only";
import { headers } from "next/headers";
import { prisma } from "@/lib/db/client";
import type { Prisma } from "@/generated/prisma/client";

// Audit log. Two sources:
//  - explicit events (sign-ins, server operations, permission changes…) written with audit() / auditUser();
//  - every create / update / delete of the main records, written by the tenant client (lib/db/audit-trail.ts).
// Values of secret fields are never stored, only the fact that they changed.

export type AuditActor = { userId: string | null; ip: string | null };

type Ctx = { organization: { id: string }; user: { id: string } };

/** The client's address as seen through the reverse proxy; null outside a request. */
export async function requestIp(): Promise<string | null> {
  try {
    const h = await headers();
    return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  } catch {
    return null;
  }
}

/** Writes one entry. Never throws: an audit failure must not break what was being done. */
export async function writeAudit(entry: {
  organizationId: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  meta?: Prisma.InputJsonValue | Record<string, unknown>;
  ip?: string | null;
}) {
  try {
    await prisma.auditLog.create({ data: { ...entry, meta: entry.meta as Prisma.InputJsonValue | undefined, ip: entry.ip ?? null } });
  } catch (e) {
    console.error("[audit] could not write", entry.action, e);
  }
}

/** An event in the current user's company. */
export async function audit(ctx: Ctx, action: string, entityType: string, entityId: string, meta?: Prisma.InputJsonValue | Record<string, unknown>) {
  await writeAudit({ organizationId: ctx.organization.id, userId: ctx.user.id, action, entityType, entityId, meta, ip: await requestIp() });
}

/** An event about a user outside any company context (sign-in, password reset): logged in each of their companies. */
export async function auditUser(userId: string, action: string, meta?: Record<string, unknown>, ip?: string | null) {
  const orgs = await prisma.membership.findMany({ where: { userId }, select: { organizationId: true } }).catch(() => []);
  const address = ip === undefined ? await requestIp() : ip;
  for (const o of orgs) await writeAudit({ organizationId: o.organizationId, userId, action, entityType: "User", entityId: userId, meta, ip: address });
}

// ── Field changes

// Bookkeeping, not edits: the villa internet check's last result (lib/connectivity.ts) changes on every check.
const SKIP = new Set([
  "id",
  "organizationId",
  "createdAt",
  "updatedAt",
  "online",
  "onlineCheckedAt",
  "onlineSince",
  "onlineLatencyMs",
  "onlineAddress",
  "onlineError",
]);
/** Secret or token fields: the log says they changed, never what to. */
export const isSecretField = (k: string) => /Enc$|password|token|secret|hash/i.test(k);
export const MASK = "••••";
const MAX_TEXT = 300;

type Decimalish = { toFixed: (n?: number) => string; toString: () => string };
const isDecimal = (v: unknown): v is Decimalish =>
  !!v && typeof v === "object" && typeof (v as Decimalish).toFixed === "function" && v.constructor?.name !== "Object";

/** A comparable, JSON-safe form of a column value. */
export function plain(v: unknown): string | number | boolean | null | unknown[] {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (isDecimal(v)) return Number(v.toString());
  if (typeof v === "string") return v.length > MAX_TEXT ? `${v.slice(0, MAX_TEXT)}…` : v;
  if (typeof v === "number" || typeof v === "boolean") return v;
  if (Array.isArray(v)) return v.map((x) => plain(x));
  try {
    const s = JSON.stringify(v);
    return s.length > MAX_TEXT ? `${s.slice(0, MAX_TEXT)}…` : s;
  } catch {
    return String(v);
  }
}

const same = (a: unknown, b: unknown) => {
  const x = plain(a);
  const y = plain(b);
  if (typeof x === "number" || typeof y === "number") {
    const nx = typeof x === "string" && x.trim() !== "" ? Number(x) : x;
    const ny = typeof y === "string" && y.trim() !== "" ? Number(y) : y;
    return nx === ny;
  }
  return JSON.stringify(x) === JSON.stringify(y);
};

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date) && !isDecimal(v);

export type Changes = Record<string, [unknown, unknown]>;

/**
 * What an update changes: scalar fields that differ from `before` ([old, new], secrets masked), plus the names
 * of relations it touched (assignees, categories…). Operators like { increment } are shown as such.
 */
export function changesOf(before: Record<string, unknown> | null, data: Record<string, unknown>) {
  const changes: Changes = {};
  const relations: string[] = [];
  for (const [k, raw] of Object.entries(data)) {
    if (SKIP.has(k) || raw === undefined) continue;
    let v: unknown = raw;
    if (isPlainObject(v)) {
      const set = (v as { set?: unknown }).set;
      // { set: [...] } is a scalar list, unless it holds records ({ id }): then it replaces a relation.
      if ("set" in v && !(Array.isArray(set) && set.some(isPlainObject))) v = set;
      else if (["increment", "decrement", "multiply", "divide"].some((op) => op in (v as object))) {
        changes[k] = [plain(before?.[k]), plain(v)];
        continue;
      } else {
        relations.push(k);
        continue;
      }
    }
    if (before && same(before[k], v)) continue;
    changes[k] = isSecretField(k) ? [MASK, MASK] : [plain(before?.[k]), plain(v)];
  }
  return { changes, relations };
}
