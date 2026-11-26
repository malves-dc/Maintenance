-- Office time on each work order ("Preparação / Planeamento"), 15 minutes by default.
-- Jobs that are closed or already invoiced keep the amounts they had (0); open ones get the default.
ALTER TABLE "WorkOrder" ADD COLUMN "prepMinutes" INTEGER NOT NULL DEFAULT 0;
UPDATE "WorkOrder" SET "prepMinutes" = 15 WHERE "invoicedAt" IS NULL AND "status" NOT IN ('DONE', 'CANCELLED');
ALTER TABLE "WorkOrder" ALTER COLUMN "prepMinutes" SET DEFAULT 15;

-- New permission workOrders.prepTime (Admin and Accountant by default): add it to those roles' saved lists in
-- Settings → Roles, so a company that changed their permissions doesn't lose it.
UPDATE "Organization"
SET "rolePermissions" = (
  SELECT jsonb_object_agg(e.key, CASE
    WHEN e.key IN ('ADMIN', 'ACCOUNTANT') AND jsonb_typeof(e.value) = 'array' AND NOT e.value ? 'workOrders.prepTime'
      THEN e.value || '["workOrders.prepTime"]'::jsonb
    ELSE e.value END)
  FROM jsonb_each("rolePermissions") AS e
)
WHERE jsonb_typeof("rolePermissions") = 'object' AND "rolePermissions" <> '{}'::jsonb;
