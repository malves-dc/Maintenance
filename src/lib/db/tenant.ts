import "server-only";
import { prisma } from "./client";
import { withAuditTrail } from "./audit-trail";
import { breaksAppendOnly } from "@/lib/request-chat-rules";
import { seriesYear } from "@/lib/series";
import type { AuditActor } from "@/lib/audit";

/**
 * Models that carry `organizationId`. Kept in sync with schema.prisma by
 * tests/tenant-models.test.ts, which fails if a model is added without being listed here.
 */
export const TENANT_MODELS = new Set([
  "Membership",
  "Invitation",
  "JobRole",
  "Counter",
  "Team",
  "Client",
  "Villa",
  "Area",
  "Asset",
  "ServiceContract",
  "Procedure",
  "Category",
  "WorkOrder",
  "Request",
  "PMSchedule",
  "Meter",
  "Part",
  "StockLocation",
  "StockMovement",
  "Vendor",
  "PurchaseOrder",
  "Conversation",
  "Notification",
  "AuditLog",
  "Attachment",
  "Subscription",
  "SyncOperation",
  "KnowledgeArticle",
  "OnCallWeek",
  "RequestMessage",
]);

const WHERE_OPS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "delete",
  "deleteMany",
  "upsert",
]);

type AnyArgs = Record<string, unknown> & {
  where?: Record<string, unknown>;
  data?: Record<string, unknown> | Record<string, unknown>[];
  create?: Record<string, unknown>;
};

/**
 * Prisma client locked to one organization: every read/update/delete on a tenant model is
 * filtered by `organizationId`, and every create gets it stamped on.
 *
 * Rules for callers:
 *  - Use unchecked foreign keys (`villaId: x`), not `villa: { connect }`, on tenant models.
 *  - Foreign keys that come from user input must be verified with `assertOwned()` first;
 *    the guard filters the row being written, not the rows it points to.
 *  - Child models without `organizationId` (checklist items, PO lines…) are only reached
 *    through a parent that was loaded through this client.
 */
export function tenantDb(organizationId: string, actor?: AuditActor) {
  return prisma.$extends({
    name: "tenant",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_MODELS.has(model)) return query(args);
          // Request chat messages are a permanent record (the database refuses it too).
          if (breaksAppendOnly(model, operation)) throw new Error(`${model} rows cannot be changed or deleted`);
          const a = (args ?? {}) as AnyArgs;

          if (WHERE_OPS.has(operation)) {
            a.where = { ...(a.where ?? {}), organizationId };
          }
          if (operation === "create") {
            a.data = { ...(a.data as Record<string, unknown>), organizationId };
          }
          if (operation === "createMany" || operation === "createManyAndReturn") {
            const rows = Array.isArray(a.data) ? a.data : [a.data!];
            a.data = rows.map((r) => ({ ...r, organizationId }));
          }
          if (operation === "upsert") {
            a.create = { ...(a.create ?? {}), organizationId };
          }
          // With an actor (a signed-in request or the scheduler), writes to the main records are audited.
          if (actor) return withAuditTrail(organizationId, actor, model, operation, a, (x) => query(x as typeof args));
          return query(a as typeof args);
        },
      },
    },
  });
}

export type TenantDb = ReturnType<typeof tenantDb>;

type OwnedModel =
  | "client"
  | "villa"
  | "area"
  | "asset"
  | "team"
  | "procedure"
  | "part"
  | "stockLocation"
  | "vendor"
  | "meter"
  | "workOrder"
  | "serviceContract"
  | "pMSchedule"
  | "purchaseOrder"
  | "category"
  | "jobRole";

/** Throws unless every given id (nulls skipped) belongs to the tenant. */
export async function assertOwned(db: TenantDb, model: OwnedModel, ids: (string | null | undefined)[]) {
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  if (unique.length === 0) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const count = await (db[model] as any).count({ where: { id: { in: unique } } });
  if (count !== unique.length) throw new Error(`Invalid ${model} reference`);
}

/** Atomically increments and returns the org's next number for `key` (e.g. "workOrder"). */
export async function nextNumber(organizationId: string, key: string): Promise<number> {
  const row = await prisma.counter.upsert({
    where: { organizationId_key: { organizationId, key } },
    create: { organizationId, key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return row.value;
}

/** The next request / work order number in the company's yearly series (lib/series.ts). */
export async function nextSeriesNumber(org: { id: string; timezone: string }) {
  const year = seriesYear(org.timezone);
  return { year, number: await nextNumber(org.id, `series:${year}`) };
}
