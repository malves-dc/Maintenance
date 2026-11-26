import { describe, expect, it } from "vitest";
import { ALL_PERMISSIONS, appOffAllows, appOffHome, builtInRoleToStore, customRoleToStore, defaultPermissions, effectivePermissions, GRANTABLE, parseRolePermissions, PERMISSION_GROUPS, rolePermissionsFor } from "@/lib/rbac";

const sorted = (s: Iterable<string>) => [...s].sort();

describe("configurable permissions", () => {
  it("lists every permission once in Settings → Roles, staff-app access included", () => {
    const shown = PERMISSION_GROUPS.flatMap((g) => g.permissions);
    expect(new Set(shown).size).toBe(shown.length);
    expect(sorted(shown)).toEqual(sorted(ALL_PERMISSIONS));
  });

  it("keeps today's defaults when nothing is changed", () => {
    for (const role of ["ADMIN", "MANAGER", "TECHNICIAN", "VIEWER", "REQUESTER"] as const) {
      expect(sorted(effectivePermissions(role, null))).toEqual(sorted(defaultPermissions(role)));
    }
  });

  it("gives the Super Admin everything, whatever is stored", () => {
    expect(sorted(effectivePermissions("OWNER", { ADMIN: [] }))).toEqual(sorted(ALL_PERMISSIONS));
  });

  it("applies a company's change to a built-in role, staff-app access included", () => {
    const overrides = { TECHNICIAN: ["internal.view", "workOrders.execute", "reports.view"] };
    expect(sorted(effectivePermissions("TECHNICIAN", overrides))).toEqual(["internal.view", "reports.view", "workOrders.execute"]);
    expect(sorted(effectivePermissions("TECHNICIAN", { TECHNICIAN: [] }))).toEqual([]);
    expect(effectivePermissions("MANAGER", overrides).has("workOrders.manage")).toBe(true); // other roles untouched
  });

  it("never grants anything unknown, and keeps the client role fixed", () => {
    const tampered = { ADMIN: ["internal.view", "nonsense", "org.manage"], REQUESTER: ["workOrders.manage"] };
    expect(effectivePermissions("ADMIN", tampered).has("billing.manage")).toBe(false); // not in its list
    expect(effectivePermissions("ADMIN", tampered).has("org.manage")).toBe(true);
    expect(sorted(effectivePermissions("REQUESTER", tampered))).toEqual(["requests.create"]);
    expect(parseRolePermissions(tampered)).toEqual({ ADMIN: ["internal.view", "org.manage"] });
  });

  it("lets a custom role follow its access level, or use its own list", () => {
    const overrides = { MANAGER: ["internal.view", "clients.manage"] };
    expect(sorted(effectivePermissions("MANAGER", overrides, null))).toEqual(["clients.manage", "internal.view"]);
    expect(sorted(effectivePermissions("MANAGER", overrides, ["internal.view", "assets.manage"]))).toEqual(["assets.manage", "internal.view"]);
  });

  it("describes a role's current list for the matrix", () => {
    expect(sorted(rolePermissionsFor("VIEWER", {}))).toEqual(["costs.view", "internal.view", "reports.view"]);
    expect(rolePermissionsFor("VIEWER", { VIEWER: ["reports.view", "assets.manage"] })).toEqual(["reports.view", "assets.manage"]);
    expect(GRANTABLE).toContain("internal.view");
  });
});

describe("saving the matrix", () => {
  const tech = rolePermissionsFor("TECHNICIAN", {});
  const techChanged = [...tech, "reports.view" as const];

  it("stores no override for a built-in role left at its defaults", () => {
    expect(builtInRoleToStore("TECHNICIAN", [...tech].reverse())).toBeNull();
    expect(builtInRoleToStore("TECHNICIAN", techChanged)).toEqual(techChanged);
  });

  it("keeps an untouched custom role following its access level when that level changes", () => {
    // Its column still shows the old technician set (it wasn't touched) → keep following Technician.
    expect(customRoleToStore(null, tech, tech, techChanged)).toBeNull();
  });

  it("stores a custom role's own list once it is changed, and drops it when it matches its level again", () => {
    expect(customRoleToStore(null, ["workOrders.execute"], tech, tech)).toEqual(["workOrders.execute"]);
    expect(customRoleToStore(["workOrders.execute"], ["workOrders.execute"], tech, tech)).toEqual(["workOrders.execute"]);
    expect(customRoleToStore(["workOrders.execute"], techChanged, tech, techChanged)).toBeNull();
  });
});

describe("accountant", () => {
  it("defaults to reports, costs, billing, preparation time and blocking villas, and billing can be given to other roles", () => {
    expect(sorted(effectivePermissions("ACCOUNTANT", null))).toEqual(["billing.manage", "billing.view", "costs.view", "internal.view", "reports.view", "villas.block", "workOrders.prepTime"]);
    expect(effectivePermissions("MANAGER", { MANAGER: ["billing.manage"] }).has("billing.manage")).toBe(true);
  });

  it("can lose costs like any other role", () => {
    expect(effectivePermissions("TECHNICIAN", { TECHNICIAN: ["workOrders.execute"] }).has("costs.view")).toBe(false);
    expect(effectivePermissions("TECHNICIAN", null).has("costs.view")).toBe(true); // today's behaviour by default
  });
});

describe("a role without the staff app", () => {
  it("can be just someone who logs hours", () => {
    expect(sorted(effectivePermissions("TECHNICIAN", { TECHNICIAN: ["timesheets.log"] }))).toEqual(["timesheets.log"]);
    expect(sorted(effectivePermissions("TECHNICIAN", null, ["timesheets.log"]))).toEqual(["timesheets.log"]);
  });

  it("stays within the hours, its profile, notifications and help", () => {
    for (const p of ["/hours", "/hours/entries", "/hours/new", "/settings/profile", "/notifications", "/help"]) expect(appOffAllows(p)).toBe(true);
    for (const p of ["/", "/dashboard", "/work-orders", "/villas/x", "/hoursx", "/settings/users", "/m"]) expect(appOffAllows(p)).toBe(false);
    expect(appOffHome(true)).toBe("/hours");
    expect(appOffHome(false)).toBe("/settings/profile");
  });
});
