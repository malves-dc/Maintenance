import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ShieldCheck } from "lucide-react";
import { ActionForm, FieldError } from "@/components/action-form";
import { Button, Card, Input, PageHeader } from "@/components/ui";
import { getContext } from "@/lib/context";
import { defaultPermissions, GRANTABLE, isEditableRole, jobRolePermissionsFor, parseRolePermissions, rolePermissionsFor } from "@/lib/rbac";
import { parseRoleRates, RATED_ROLES } from "@/lib/roles";
import type { Role } from "@/generated/prisma/enums";
import { createJobRoleAction, saveRolesAction } from "./actions";
import { DeleteJobRoleButton } from "./delete-button";
import { titled } from "@/lib/metadata";

export const generateMetadata = titled("nav.roles");

const BUILT_IN: Role[] = ["OWNER", "ADMIN", "MANAGER", "TECHNICIAN", "VIEWER", "ACCOUNTANT", "REQUESTER"];

type Row = { key: string; name: string; members: number; granted: number; rate: unknown; rated: boolean; created: boolean };

/**
 * One list of roles: the ones the program comes with and the ones the company created work the same way
 * (people, permissions, cost per hour). Created roles can also be renamed and deleted.
 */
export default async function RolesPage() {
  const ctx = await getContext();
  if (!ctx.can("users.manage")) notFound();
  const t = await getTranslations();
  const rates = parseRoleRates(ctx.organization.roleRates);
  const overrides = parseRolePermissions(ctx.organization.rolePermissions);
  const [jobRoles, counts] = await Promise.all([
    ctx.db.jobRole.findMany({ include: { _count: { select: { memberships: { where: { active: true } } } } } }),
    ctx.db.membership.groupBy({ by: ["role"], where: { active: true, jobRoleId: null }, _count: true }),
  ]);
  const currency = ctx.organization.currency;

  const grantedCount = (role: Role) =>
    role === "OWNER" ? GRANTABLE.length : isEditableRole(role) ? rolePermissionsFor(role, overrides).length : GRANTABLE.filter((p) => defaultPermissions(role).includes(p)).length;
  const rows: Row[] = [
    ...BUILT_IN.map((r) => ({
      key: r,
      name: t(`roles.${r}`),
      members: counts.find((c) => c.role === r)?._count ?? 0,
      granted: grantedCount(r),
      rate: rates[r],
      rated: (RATED_ROLES as readonly Role[]).includes(r),
      created: false,
    })),
    ...jobRoles.map((j) => ({
      key: j.id,
      name: j.name,
      members: j._count.memberships,
      granted: jobRolePermissionsFor(j.access, j.permissions, overrides).length,
      rate: j.hourlyRate,
      rated: true,
      created: true,
    })),
  ].sort((a, b) => a.name.localeCompare(b.name));

  const rateInput = (name: string, value: unknown) => (
    <div className="flex items-center justify-end gap-1.5">
      <Input name={name} type="number" min={0} step="0.01" defaultValue={value == null ? "" : String(value)} placeholder="—" className="h-9 w-28 text-right tabular-nums" />
      <span className="w-8 text-xs text-muted">{currency}</span>
    </div>
  );

  return (
    <>
      <PageHeader title={t("roles.title")} description={t("roles.description")} />
      <div className="max-w-5xl space-y-6">
        <Card className="p-5">
          <p className="mb-4 text-sm text-muted">{t("roles.listHint")}</p>
          <ActionForm action={saveRolesAction} successMessage={t("common.saved")}>
            <div className="divide-y divide-border rounded-md border border-border">
              {rows.map((r) => (
                <div key={r.key} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-48 flex-1 space-y-1">
                    {r.created ? (
                      <>
                        <Input name={`name.${r.key}`} defaultValue={r.name} maxLength={60} required aria-label={t("common.name")} className="h-9 max-w-xs" />
                        <FieldError name={`name.${r.key}`} />
                      </>
                    ) : (
                      <div className="text-sm font-medium">{r.name}</div>
                    )}
                    <div className="text-xs text-muted">{t("roles.members", { count: r.members })}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="hidden text-xs tabular-nums text-muted sm:inline">{t("perms.summary", { on: r.granted, total: GRANTABLE.length })}</span>
                    <Link href={`/settings/roles/${r.key}/permissions`}>
                      <Button type="button" size="sm" variant="secondary">
                        <ShieldCheck className="size-4" />
                        {t("perms.title")}
                      </Button>
                    </Link>
                  </div>
                  <div className="w-[11.5rem]">
                    {r.rated ? (
                      <>
                        {rateInput(`rate.${r.key}`, r.rate)}
                        <FieldError name={`rate.${r.key}`} />
                      </>
                    ) : (
                      <span className="block text-right text-xs text-muted">{t("roles.notBillable")}</span>
                    )}
                  </div>
                  <div className="w-20 text-right">{r.created && <DeleteJobRoleButton id={r.key} name={r.name} members={r.members} />}</div>
                </div>
              ))}
            </div>
          </ActionForm>
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 text-sm font-medium">{t("roles.new")}</h2>
          {/* Keyed on the count so the form clears after a role is created. */}
          <ActionForm key={jobRoles.length} action={createJobRoleAction} submitLabel={t("common.create")}>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <label className="block space-y-1">
                <span className="text-xs text-muted">{t("common.name")}</span>
                <Input name="name" placeholder={t("roles.namePlaceholder")} maxLength={60} required />
                <FieldError name="name" />
              </label>
              <label className="block space-y-1">
                <span className="block text-right text-xs text-muted">{t("roles.costPerHour")}</span>
                {rateInput("hourlyRate", null)}
                <FieldError name="hourlyRate" />
              </label>
            </div>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
