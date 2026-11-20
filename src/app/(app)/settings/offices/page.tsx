import { NOT_IN_STAFF_LISTS } from "@/lib/rbac";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Star, Trash2 } from "lucide-react";
import { ActionForm, FieldError } from "@/components/action-form";
import { ConfirmIconButton } from "@/components/confirm-button";
import { Badge, Card, Field, Input, PageHeader } from "@/components/ui";
import { getContext } from "@/lib/context";
import { osrmBase } from "@/lib/offices";
import { deleteOfficeAction, removeOfficeMemberAction, saveOfficeAction, setPrimaryOfficeAction } from "./actions";
import { AddOfficeMember, DistanceSettings, PrimaryButton } from "./client";

export default async function OfficesPage() {
  const ctx = await getContext();
  if (!ctx.can("org.manage")) notFound();
  const t = await getTranslations();

  const [offices, members, villaCount] = await Promise.all([
    ctx.db.office.findMany({
      include: {
        members: { select: { userId: true, primary: true, user: { select: { name: true } } } },
        _count: { select: { villas: true, distances: true } },
      },
      orderBy: { name: "asc" },
    }),
    ctx.db.membership.findMany({ where: { active: true, role: { notIn: NOT_IN_STAFF_LISTS } }, select: { user: { select: { id: true, name: true } } } }),
    ctx.db.villa.count({ where: { archivedAt: null } }),
  ]);
  const people = members.map((m) => m.user).sort((a, b) => a.name.localeCompare(b.name));
  // How many offices each person works from: the primary star only matters with two or more.
  const officesOf = new Map<string, number>();
  for (const o of offices) for (const m of o.members) officesOf.set(m.userId, (officesOf.get(m.userId) ?? 0) + 1);
  const unassigned = people.filter((p) => !officesOf.has(p.id));

  const officeFields = (o?: (typeof offices)[number]) => (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("common.name")}>
          <Input name="name" required maxLength={100} defaultValue={o?.name ?? ""} />
          <FieldError name="name" />
        </Field>
        <Field label={t("villas.address")}>
          <Input name="address" maxLength={300} defaultValue={o?.address ?? ""} />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("villas.latitude")}>
          <Input name="latitude" inputMode="decimal" defaultValue={o?.latitude ?? ""} placeholder="37.0194" />
          <FieldError name="latitude" />
        </Field>
        <Field label={t("villas.longitude")}>
          <Input name="longitude" inputMode="decimal" defaultValue={o?.longitude ?? ""} placeholder="-7.9304" />
          <FieldError name="longitude" />
        </Field>
      </div>
    </>
  );

  return (
    <>
      <PageHeader title={t("offices.title")} description={t("offices.description")} />

      <Card className="mb-6 p-5">
        <h2 className="mb-1 font-medium">{t("offices.distancesTitle")}</h2>
        <DistanceSettings road={ctx.organization.roadDistances} server={new URL(osrmBase()).host} hasOffices={offices.length > 0} />
      </Card>

      <Card className="mb-6 p-5">
        <h2 className="mb-1 font-medium">{t("offices.new")}</h2>
        <p className="mb-4 text-sm text-muted">{offices.length === 0 ? t("offices.firstHint") : t("offices.newHint")}</p>
        <ActionForm key={offices.length} action={saveOfficeAction.bind(null, null)} submitLabel={t("common.create")}>
          {officeFields()}
        </ActionForm>
      </Card>

      {offices.length === 0 ? (
        <p className="text-sm text-muted">{t("offices.none")}</p>
      ) : (
        <>
          {unassigned.length > 0 && <p className="mb-4 text-sm text-muted">{t("offices.withoutOffice", { names: unassigned.map((p) => p.name).join(", ") })}</p>}
          <div className="grid gap-4 lg:grid-cols-2">
            {offices.map((o) => {
              const memberIds = new Set(o.members.map((m) => m.userId));
              return (
                <Card key={o.id} className="p-5">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-medium">{o.name}</h3>
                      <p className="text-xs text-muted">
                        {t("offices.stats", { villas: o._count.villas, distances: o._count.distances, total: villaCount })}
                        {o.latitude == null && <> · {t("offices.noCoordinates")}</>}
                      </p>
                    </div>
                    <ConfirmIconButton action={deleteOfficeAction.bind(null, o.id)} title={t("common.delete")} confirmText={t("offices.deleteConfirm", { name: o.name })}>
                      <Trash2 className="size-4" />
                    </ConfirmIconButton>
                  </div>

                  <h4 className="mb-1 text-xs font-medium uppercase text-muted">{t("offices.people")}</h4>
                  <ul className="mb-3 space-y-1">
                    {o.members
                      .sort((a, b) => a.user.name.localeCompare(b.user.name))
                      .map((m) => (
                        <li key={m.userId} className="flex items-center justify-between gap-2 text-sm">
                          <span className="flex items-center gap-1.5">
                            {m.user.name}
                            {(officesOf.get(m.userId) ?? 0) > 1 &&
                              (m.primary ? (
                                <Badge className="gap-1">
                                  <Star className="size-3" />
                                  {t("offices.primary")}
                                </Badge>
                              ) : (
                                <PrimaryButton action={setPrimaryOfficeAction.bind(null, o.id, m.userId)} />
                              ))}
                          </span>
                          <ConfirmIconButton action={removeOfficeMemberAction.bind(null, o.id, m.userId)} />
                        </li>
                      ))}
                  </ul>
                  <AddOfficeMember officeId={o.id} options={people.filter((p) => !memberIds.has(p.id))} />

                  <details className="mt-4">
                    <summary className="cursor-pointer text-sm text-brand">{t("common.edit")}</summary>
                    <div className="mt-3">
                      <ActionForm action={saveOfficeAction.bind(null, o.id)} successMessage={t("common.saved")}>
                        {officeFields(o)}
                      </ActionForm>
                    </div>
                  </details>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
