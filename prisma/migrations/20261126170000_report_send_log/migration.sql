-- The service report's send history (lib/report-send-log.ts): who sent it, whether it was the accountants' automatic
-- copy, and which revision.
ALTER TABLE "ReportSend" ADD COLUMN "sentById" TEXT, ADD COLUMN "auto" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "revision" INTEGER;
ALTER TABLE "ReportSend" ADD CONSTRAINT "ReportSend_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Earlier sends are in the audit log (workOrder.reportSent: who, the addresses, and for automatic copies the revision).
-- 1. The rows already kept (the last send of each job) get who sent it, from the entry written right after it (the
--    nearest one: two sends a few seconds apart must each find their own).
UPDATE "ReportSend" s
SET ("sentById", "auto", "revision") = (
  SELECT x."userId", (x."meta" ? 'auto'), CASE WHEN jsonb_typeof(x."meta"->'revision') = 'number' THEN (x."meta"->>'revision')::int END
  FROM "AuditLog" x
  WHERE x."action" = 'workOrder.reportSent' AND x."entityType" = 'WorkOrder' AND x."entityId" = s."workOrderId"
    AND jsonb_typeof(x."meta"->'to') = 'array'
    AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(x."meta"->'to') t(email) WHERE lower(t.email) = s."email")
    AND abs(extract(epoch FROM (x."createdAt" - s."sentAt"))) < 10
  ORDER BY abs(extract(epoch FROM (x."createdAt" - s."sentAt")))
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1 FROM "AuditLog" x
  WHERE x."action" = 'workOrder.reportSent' AND x."entityType" = 'WorkOrder' AND x."entityId" = s."workOrderId"
    AND jsonb_typeof(x."meta"->'to') = 'array'
    AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(x."meta"->'to') t(email) WHERE lower(t.email) = s."email")
    AND abs(extract(epoch FROM (x."createdAt" - s."sentAt"))) < 10
);

-- 2. Sends that weren't kept per address (all but the last one): added from the audit log.
INSERT INTO "ReportSend" ("id", "workOrderId", "email", "sentAt", "sentById", "auto", "revision")
SELECT 'rs' || md5(a."id" || '/' || lower(t.email)), a."entityId", lower(t.email), a."createdAt", a."userId", (a."meta" ? 'auto'),
       CASE WHEN jsonb_typeof(a."meta"->'revision') = 'number' THEN (a."meta"->>'revision')::int END
FROM "AuditLog" a
CROSS JOIN LATERAL jsonb_array_elements_text(a."meta"->'to') t(email)
JOIN "WorkOrder" w ON w."id" = a."entityId"
WHERE a."action" = 'workOrder.reportSent' AND a."entityType" = 'WorkOrder' AND jsonb_typeof(a."meta"->'to') = 'array'
  AND NOT EXISTS (
    SELECT 1 FROM "ReportSend" s
    WHERE s."workOrderId" = a."entityId" AND s."email" = lower(t.email) AND abs(extract(epoch FROM (a."createdAt" - s."sentAt"))) < 10
  )
ON CONFLICT ("id") DO NOTHING;
