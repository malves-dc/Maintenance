-- Blocked villas: no work orders can be created for them (lib/villa-block.ts).
ALTER TABLE "Villa" ADD COLUMN "blockedAt" TIMESTAMP(3), ADD COLUMN "blockedById" TEXT;
ALTER TABLE "Villa" ADD CONSTRAINT "Villa_blockedById_fkey" FOREIGN KEY ("blockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- New permission villas.block (Admin, Manager and Accountant by default): add it to those roles' saved lists in
-- Settings → Roles, so a company that changed their permissions doesn't lose it.
UPDATE "Organization"
SET "rolePermissions" = (
  SELECT jsonb_object_agg(e.key, CASE
    WHEN e.key IN ('ADMIN', 'MANAGER', 'ACCOUNTANT') AND jsonb_typeof(e.value) = 'array' AND NOT e.value ? 'villas.block'
      THEN e.value || '["villas.block"]'::jsonb
    ELSE e.value END)
  FROM jsonb_each("rolePermissions") AS e
)
WHERE jsonb_typeof("rolePermissions") = 'object' AND "rolePermissions" <> '{}'::jsonb;
