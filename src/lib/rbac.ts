import type { Role } from "@/generated/prisma/enums";

// Permissions. PERMISSIONS is the default matrix; the Super Admin (role OWNER) can change what each
// staff role — and each custom role — may do in Settings → Roles. Pure: shared by context, notify, pages, tests.

export const PERMISSIONS = {
  "org.manage": ["OWNER", "ADMIN"],
  "billing.manage": ["OWNER", "ACCOUNTANT"], // invoicing (no screens yet; for a future billing module / Odoo)
  "costs.view": ["OWNER", "ADMIN", "MANAGER", "TECHNICIAN", "VIEWER", "ACCOUNTANT"], // labour, parts and totals, contract fees
  "users.manage": ["OWNER", "ADMIN"],
  "audit.view": ["OWNER", "ADMIN"], // Settings → Audit log: who did what, from where
  "teams.manage": ["OWNER", "ADMIN", "MANAGER"],
  "clients.manage": ["OWNER", "ADMIN", "MANAGER"],
  "contracts.manage": ["OWNER", "ADMIN", "MANAGER"],
  "assets.manage": ["OWNER", "ADMIN", "MANAGER", "TECHNICIAN"],
  "secrets.view": ["OWNER", "ADMIN", "MANAGER", "TECHNICIAN"],
  "knowledge.manage": ["OWNER", "ADMIN", "MANAGER", "TECHNICIAN"], // write villa knowledge-base articles (reading = internal.view)
  "workOrders.create": ["OWNER", "ADMIN", "MANAGER", "TECHNICIAN"],
  "workOrders.manage": ["OWNER", "ADMIN", "MANAGER"], // assign, delete, edit anyone's
  "workOrders.execute": ["OWNER", "ADMIN", "MANAGER", "TECHNICIAN"],
  "workOrders.sendReport": ["OWNER", "ADMIN", "MANAGER"], // e-mail the PDF service report
  "requests.create": ["OWNER", "ADMIN", "MANAGER", "TECHNICIAN", "REQUESTER"],
  "requests.approve": ["OWNER", "ADMIN", "MANAGER"],
  "requests.chat": ["OWNER", "ADMIN", "MANAGER"], // take part in every request's chat with the client (assigned technicians always can, on their jobs)
  "onCall.manage": ["OWNER", "ADMIN"], // on-call team and its weekly rota, from Settings → Staff (whoever is on call receives every client request)
  "pm.manage": ["OWNER", "ADMIN", "MANAGER"],
  "procedures.manage": ["OWNER", "ADMIN", "MANAGER"],
  "inventory.manage": ["OWNER", "ADMIN", "MANAGER"],
  "inventory.use": ["OWNER", "ADMIN", "MANAGER", "TECHNICIAN"],
  "purchasing.manage": ["OWNER", "ADMIN", "MANAGER"],
  "purchasing.approve": ["OWNER", "ADMIN"],
  "vendors.manage": ["OWNER", "ADMIN", "MANAGER"],
  "reports.view": ["OWNER", "ADMIN", "MANAGER", "VIEWER", "ACCOUNTANT"],
  "internal.view": ["OWNER", "ADMIN", "MANAGER", "TECHNICIAN", "VIEWER", "ACCOUNTANT"], // anything not client-facing
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

/** Staff roles whose permissions the Super Admin can change. OWNER always has everything; the client role is fixed. */
export const EDITABLE_ROLES = ["ADMIN", "MANAGER", "TECHNICIAN", "VIEWER", "ACCOUNTANT"] as const satisfies readonly Role[];
export type EditableRole = (typeof EDITABLE_ROLES)[number];
export const isEditableRole = (r: string): r is EditableRole => (EDITABLE_ROLES as readonly string[]).includes(r);

/** Always on for staff roles: it is access to the staff app itself (without it an account can't open anything). */
export const STAFF_BASE: Permission[] = ["internal.view"];

/** Permissions shown in Settings → Roles, by section. */
export const PERMISSION_GROUPS: { key: string; permissions: Permission[] }[] = [
  { key: "admin", permissions: ["org.manage", "users.manage", "onCall.manage", "teams.manage", "audit.view"] },
  { key: "work", permissions: ["workOrders.create", "workOrders.execute", "workOrders.manage", "workOrders.sendReport", "requests.create", "requests.approve", "requests.chat", "pm.manage", "procedures.manage"] },
  { key: "sites", permissions: ["clients.manage", "contracts.manage", "assets.manage", "secrets.view", "knowledge.manage"] },
  { key: "supply", permissions: ["inventory.use", "inventory.manage", "vendors.manage", "purchasing.manage", "purchasing.approve"] },
  { key: "insights", permissions: ["reports.view"] },
  { key: "finance", permissions: ["costs.view", "billing.manage"] },
];
export const GRANTABLE: Permission[] = PERMISSION_GROUPS.flatMap((g) => g.permissions);

const isPermission = (p: unknown): p is Permission => typeof p === "string" && p in PERMISSIONS;

export function defaultPermissions(role: Role): Permission[] {
  return ALL_PERMISSIONS.filter((p) => (PERMISSIONS[p] as readonly Role[]).includes(role));
}

/** A stored permission list (unknown or non-grantable entries dropped); null when absent or malformed. */
export function parsePermissionList(raw: unknown): Permission[] | null {
  if (!Array.isArray(raw)) return null;
  return GRANTABLE.filter((p) => raw.includes(p));
}

export type RolePermissions = Partial<Record<EditableRole, Permission[]>>;

/** Organization.rolePermissions → overrides per built-in staff role (missing = defaults). */
export function parseRolePermissions(raw: unknown): RolePermissions {
  const out: RolePermissions = {};
  if (raw && typeof raw === "object") {
    for (const r of EDITABLE_ROLES) {
      const list = parsePermissionList((raw as Record<string, unknown>)[r]);
      if (list) out[r] = list;
    }
  }
  return out;
}

/** What a built-in staff role may do in this company (its override, else the default). */
export function rolePermissionsFor(role: EditableRole, overrides: RolePermissions): Permission[] {
  return overrides[role] ?? GRANTABLE.filter((p) => defaultPermissions(role).includes(p));
}

/** What a custom role may do: its own list, else its access level's (possibly overridden) list. */
export function jobRolePermissionsFor(access: string, own: unknown, overrides: RolePermissions): Permission[] {
  return parsePermissionList(own) ?? (isEditableRole(access) ? rolePermissionsFor(access, overrides) : []);
}

/**
 * Effective permissions of a member: everything for the Super Admin, the fixed set for clients, else the
 * custom role's own list, or its access level's (possibly overridden) list — plus access to the staff app.
 */
export function effectivePermissions(role: Role, orgOverrides: unknown, jobRolePermissions?: unknown): Set<Permission> {
  if (role === "OWNER") return new Set(ALL_PERMISSIONS);
  if (!isEditableRole(role)) return new Set(defaultPermissions(role));
  const own = parsePermissionList(jobRolePermissions);
  const list = own ?? rolePermissionsFor(role, parseRolePermissions(orgOverrides));
  return new Set([...STAFF_BASE, ...list.filter(isPermission)]);
}

/** Default matrix check (no company overrides); prefer ctx.can(), which applies them. */
export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export const ASSIGNABLE_ROLES: Role[] = ["ADMIN", "MANAGER", "TECHNICIAN", "ACCOUNTANT", "REQUESTER", "VIEWER"];

const sameSet = (a: Permission[], b: Permission[]) => a.length === b.length && a.every((p) => b.includes(p));

/**
 * What to store for a custom role after a save of the permission matrix: null (follow its access level)
 * when it was following and its column wasn't touched, or when it now matches its level again; else its list.
 */
export function customRoleToStore(stored: unknown, submitted: Permission[], levelBefore: Permission[], levelAfter: Permission[]): Permission[] | null {
  const untouched = parsePermissionList(stored) === null && sameSet(submitted, levelBefore);
  return untouched || sameSet(submitted, levelAfter) ? null : submitted;
}

/** What to store for a built-in role: null when it matches the defaults (so it keeps following them). */
export function builtInRoleToStore(role: EditableRole, submitted: Permission[]): Permission[] | null {
  return sameSet(submitted, rolePermissionsFor(role, {})) ? null : submitted;
}
