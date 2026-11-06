import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { Priority, SystemType, WorkOrderStatus } from "@/generated/prisma/enums";
import type { TenantDb } from "@/lib/db/tenant";
import { FUZZY_MIN, matchRanges, searchTerms, snippet, WORD_SIMILARITY, type Range, type Snippet } from "@/lib/search-text";

// Fuzzy search over everything written on work orders: title, description, the request it came from,
// comments, checklist notes and text answers, time-entry notes and status-change notes. Matching is case-
// and accent-insensitive, any part of a word counts ("proc" finds "processador"), and words of 4+ letters
// also match with typos (pg_trgm word similarity). Every word of the query must appear somewhere in the
// work order, not necessarily in the same note. Used by /search (web) and /api/search (field app).

/** Where a match was found. "title", "asset" and "villa" only count towards the terms; the rest are listed. */
export type HitKind = "description" | "workReport" | "request" | "comment" | "itemNote" | "itemAnswer" | "timeNote" | "statusNote";
const LISTED = new Set<string>(["description", "workReport", "request", "comment", "itemNote", "itemAnswer", "timeNote", "statusNote"]);

export type SearchHit = {
  kind: HitKind;
  id: string;
  /** The checklist step's label, or the status a status note moved the job to. */
  label: string | null;
  author: string | null;
  at: string | null;
  snippet: Snippet;
};

export type SearchResult = {
  id: string;
  number: number;
  title: string;
  titleMarks: Range[];
  status: WorkOrderStatus;
  priority: Priority;
  system: SystemType | null;
  villa: string | null;
  asset: string | null;
  createdAt: string;
  completedAt: string | null;
  hits: SearchHit[];
  /** All the notes that matched; `hits` holds the best few. */
  hitCount: number;
};

export type SearchFilters = { villaId?: string; system?: SystemType };

/** Notes listed per work order. */
const HITS_SHOWN = 3;
/** Matching notes read from the database, newest first; enough for any realistic query. */
const MAX_ROWS = 3000;

type Row = {
  workOrderId: string;
  kind: string;
  sourceId: string;
  text: string;
  userId: string | null;
  label: string | null;
  at: Date | null;
  hits: number[];
  score: number;
};

export async function searchWorkOrders(
  db: TenantDb,
  organizationId: string,
  query: string,
  filters: SearchFilters = {},
  limit = 50,
): Promise<{ terms: string[]; results: SearchResult[]; truncated: boolean }> {
  const terms = searchTerms(query);
  if (terms.length === 0) return { terms, results: [], truncated: false };

  const scope = Prisma.sql`"organizationId" = ${organizationId}
    ${filters.villaId ? Prisma.sql`AND "villaId" = ${filters.villaId}` : Prisma.empty}
    ${filters.system ? Prisma.sql`AND "system" = ${filters.system}::"SystemType"` : Prisma.empty}`;

  // The raw query bypasses the tenant guard: every source joins through `wo`, which is scoped above.
  const rows = await db.$queryRaw<Row[]>`
    WITH wo AS (SELECT id, "villaId", "assetId" FROM "WorkOrder" WHERE ${scope}),
    docs AS (
      SELECT w.id AS "workOrderId", 'title' AS kind, w.id AS "sourceId", w.title AS text, NULL::text AS "userId", NULL::text AS label, w."createdAt" AS at
        FROM "WorkOrder" w JOIN wo ON wo.id = w.id
      UNION ALL
      SELECT w.id, 'description', w.id, w.description, w."createdById", NULL, w."createdAt"
        FROM "WorkOrder" w JOIN wo ON wo.id = w.id WHERE w.description <> ''
      UNION ALL
      SELECT w.id, 'workReport', w.id, w."workReport", w."completedById", NULL, COALESCE(w."completedAt", w."updatedAt")
        FROM "WorkOrder" w JOIN wo ON wo.id = w.id WHERE w."workReport" <> ''
      UNION ALL
      SELECT r."workOrderId", 'request', r.id, r.description, r."requesterId", r."requesterName", r."createdAt"
        FROM "Request" r JOIN wo ON wo.id = r."workOrderId" WHERE r.description <> ''
      UNION ALL
      SELECT c."workOrderId", 'comment', c.id, c.body, c."userId", NULL, c."createdAt"
        FROM "WorkOrderComment" c JOIN wo ON wo.id = c."workOrderId"
      UNION ALL
      SELECT i."workOrderId", 'itemNote', i.id, i.note, i."completedById", i.label, i."completedAt"
        FROM "WorkOrderItem" i JOIN wo ON wo.id = i."workOrderId" WHERE i.note <> ''
      UNION ALL
      SELECT i."workOrderId", 'itemAnswer', i.id, i.value, i."completedById", i.label, i."completedAt"
        FROM "WorkOrderItem" i JOIN wo ON wo.id = i."workOrderId" WHERE i.type = 'TEXT' AND i.value <> ''
      UNION ALL
      SELECT t."workOrderId", 'timeNote', t.id, t.note, t."userId", NULL, t."startedAt"
        FROM "TimeEntry" t JOIN wo ON wo.id = t."workOrderId" WHERE t.note <> ''
      UNION ALL
      SELECT s."workOrderId", 'statusNote', s.id, s.note, s."userId", s."toStatus"::text, s."createdAt"
        FROM "WorkOrderStatusLog" s JOIN wo ON wo.id = s."workOrderId" WHERE s.note <> ''
      UNION ALL
      SELECT wo.id, 'asset', a.id, a.name, NULL, NULL, NULL FROM wo JOIN "Asset" a ON a.id = wo."assetId"
      UNION ALL
      SELECT wo.id, 'villa', v.id, v.name, NULL, NULL, NULL FROM wo JOIN "Villa" v ON v.id = wo."villaId"
    )
    SELECT d."workOrderId", d.kind, d."sourceId", d.text, d."userId", d.label, d.at, m.hits, m.score
    FROM (SELECT docs.*, unaccent(lower(docs.text)) AS norm FROM docs) d
    CROSS JOIN LATERAL (
      SELECT array_agg(q.i::int) AS hits,
             sum(CASE WHEN strpos(d.norm, q.term) > 0 THEN 1 ELSE word_similarity(q.term, d.norm) END)::float8 AS score
      FROM unnest(${terms}::text[]) WITH ORDINALITY AS q(term, i)
      WHERE strpos(d.norm, q.term) > 0
         OR (char_length(q.term) >= ${FUZZY_MIN} AND word_similarity(q.term, d.norm) >= ${WORD_SIMILARITY})
    ) m
    WHERE m.hits IS NOT NULL
    ORDER BY d.at DESC NULLS LAST
    LIMIT ${MAX_ROWS}`;

  // Keep the work orders where every term matched somewhere.
  const byWo = new Map<string, { covered: Set<number>; best: number; latest: number; rows: Row[] }>();
  for (const row of rows) {
    const entry = byWo.get(row.workOrderId) ?? { covered: new Set<number>(), best: 0, latest: 0, rows: [] };
    row.hits.forEach((h) => entry.covered.add(h));
    entry.best = Math.max(entry.best, row.score);
    entry.latest = Math.max(entry.latest, row.at?.getTime() ?? 0);
    if (LISTED.has(row.kind)) entry.rows.push(row);
    byWo.set(row.workOrderId, entry);
  }
  const ranked = [...byWo.entries()]
    .filter(([, e]) => e.covered.size === terms.length)
    .sort(([, a], [, b]) => b.best - a.best || b.latest - a.latest);
  const top = ranked.slice(0, limit);
  if (top.length === 0) return { terms, results: [], truncated: false };

  const shownRows = top.flatMap(([, e]) => bestRows(e.rows));
  const userIds = [...new Set(shownRows.map((r) => r.userId).filter((id): id is string => !!id))];
  const [wos, members] = await Promise.all([
    db.workOrder.findMany({
      where: { id: { in: top.map(([id]) => id) } },
      select: {
        id: true,
        number: true,
        title: true,
        status: true,
        priority: true,
        system: true,
        createdAt: true,
        completedAt: true,
        villa: { select: { name: true } },
        asset: { select: { name: true } },
      },
    }),
    userIds.length
      ? db.membership.findMany({ where: { userId: { in: userIds } }, select: { user: { select: { id: true, name: true } } } })
      : [],
  ]);
  const names = new Map(members.map((m) => [m.user.id, m.user.name]));
  const woById = new Map(wos.map((w) => [w.id, w]));

  const results = top.flatMap(([id, e]): SearchResult[] => {
    const w = woById.get(id);
    if (!w) return [];
    return [
      {
        id: w.id,
        number: w.number,
        title: w.title,
        titleMarks: matchRanges(w.title, terms),
        status: w.status,
        priority: w.priority,
        system: w.system,
        villa: w.villa?.name ?? null,
        asset: w.asset?.name ?? null,
        createdAt: w.createdAt.toISOString(),
        completedAt: w.completedAt?.toISOString() ?? null,
        hitCount: e.rows.length,
        hits: bestRows(e.rows).map((r) => ({
          kind: r.kind as HitKind,
          id: r.sourceId,
          label: r.label,
          // A request from a QR label has no account, only the name the person typed (kept in `label`).
          author: (r.userId && names.get(r.userId)) || (r.kind === "request" ? r.label : null),
          at: r.at?.toISOString() ?? null,
          snippet: snippet(r.text, terms),
        })).map((h) => (h.kind === "request" ? { ...h, label: null } : h)),
      },
    ];
  });
  return { terms, results, truncated: ranked.length > limit || rows.length >= MAX_ROWS };
}

/** The notes worth showing first: those matching the most terms, then the newest. */
function bestRows(rows: Row[]): Row[] {
  return [...rows].sort((a, b) => b.score - a.score || (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0)).slice(0, HITS_SHOWN);
}
