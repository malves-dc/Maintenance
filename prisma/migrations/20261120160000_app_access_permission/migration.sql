-- "Access the maintenance app" (internal.view) used to be always on for staff roles, so saved permission lists
-- never held it. It is now a permission like any other: add it to every saved list so nobody loses access.

-- Built-in roles changed in Settings → Roles: {"TECHNICIAN": [...], ...}
UPDATE "Organization"
SET "rolePermissions" = (
  SELECT jsonb_object_agg(e.key, CASE
    WHEN jsonb_typeof(e.value) = 'array' AND NOT e.value ? 'internal.view' THEN e.value || '["internal.view"]'::jsonb
    ELSE e.value END)
  FROM jsonb_each("rolePermissions") AS e
)
WHERE jsonb_typeof("rolePermissions") = 'object' AND "rolePermissions" <> '{}'::jsonb;

-- Custom roles with their own list (null = follow their access level, which now includes it by default).
UPDATE "JobRole"
SET "permissions" = "permissions" || '["internal.view"]'::jsonb
WHERE jsonb_typeof("permissions") = 'array' AND NOT "permissions" ? 'internal.view';
