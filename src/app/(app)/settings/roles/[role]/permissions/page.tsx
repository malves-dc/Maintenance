import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Lock } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { BackLink } from "@/components/back-link";
import { Badge, PageHeader } from "@/components/ui";
import { getContext } from "@/lib/context";
import { defaultPermissions, GRANTABLE, isEditableRole, jobRolePermissionsFor, parsePermissionList, parseRolePermissions, PERMISSION_GROUPS, rolePermissionsFor, type Permission } from "@/lib/rbac";
import { titled } from "@/lib/metadata";
import { saveRolePermissionsAction } from "../../actions";
import { PermissionList, ResetRolePermissionsButton } from "./client";

export const generateMetadata = titled("perms.title");

/**
 * What one role may do, opened from its "Permissions" button in Settings → Roles. `role` is a built-in role or the
 * id of a role the company created. The Super Admin edits it; everyone else with access to Roles sees it read-only.
 * Super Admin (everything) and the client role are fixed.
 */
export default async function RolePermissionsPage({ params }: PageProps<"/settings/roles/[role]/permissions">) {
  const ctx = await getContext();
  if (!ctx.can("users.manage")) notFound();
  const t = await getTranslations();
  const { role: key } = await params;
  const overrides = parseRolePermissions(ctx.organization.rolePermissions);

  let name: string;
  let granted: Permission[];
  let customised = false;
  let fixed = false;
  if (key === "OWNER" || key === "REQUESTER") {
    name = t(`roles.${key}`);
    granted = key === "OWNER" ? GRANTABLE : GRANTABLE.filter((p) => defaultPermissions("REQUESTER").includes(p));
    fixed = true;
  } else if (isEditableRole(key)) {
    name = t(`roles.${key}`);
    granted = rolePermissionsFor(key, overrides);
    customised = !!overrides[key];
  } else {
    const j = await ctx.db.jobRole.findFirst({ where: { id: key }, select: { name: true, access: true, permissions: true } });
    if (!j) notFound();
    name = j.name;
    granted = jobRolePermissionsFor(j.access, j.permissions, overrides);
    customised = parsePermissionList(j.permissions) !== null;
  }
  const editable = ctx.role === "OWNER" && !fixed;

  const groups = PERMISSION_GROUPS.map((g) => ({
    key: g.key,
    title: t(`permGroup.${g.key}` as never),
    items: g.permissions.map((p) => ({ permission: p, label: t(`perm.${p}.label` as never), hint: t(`perm.${p}.hint` as never) })),
  }));
  // Keyed on what is saved, so the checkboxes follow a save or a reset.
  const list = <PermissionList key={granted.join()} groups={groups} granted={granted} disabled={!editable} />;

  return (
    <>
      <BackLink href="/settings/roles" label={t("roles.title")} />
      <PageHeader
        title={t("perms.pageTitle", { role: name })}
        description={t(fixed ? (key === "OWNER" ? "perms.fixedAllHint" : "perms.fixedClientHint") : "perms.pageHint")}
        actions={customised && <Badge className="bg-amber-50 text-amber-800">{t("perms.customised")}</Badge>}
      />
      <div className="max-w-3xl">
        {!editable && !fixed && (
          <p className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted">
            <Lock className="size-3.5" />
            {t("perms.ownerOnly")}
          </p>
        )}
        {editable ? (
          <ActionForm
            action={saveRolePermissionsAction.bind(null, key)}
            successMessage={t("common.saved")}
            footer={customised && <ResetRolePermissionsButton roleKey={key} />}
          >
            {list}
          </ActionForm>
        ) : (
          list
        )}
      </div>
    </>
  );
}
