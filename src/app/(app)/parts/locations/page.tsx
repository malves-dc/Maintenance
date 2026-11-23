import { membersWith } from "@/lib/notify";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Truck, Warehouse, House } from "lucide-react";
import { Badge, Card, Field, Input, PageHeader, Select } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { ActionForm, FieldError } from "@/components/action-form";
import { ArchiveButton } from "@/components/archive-button";
import { getContext } from "@/lib/context";
import { StockLocationType } from "@/generated/prisma/enums";
import type { StockLocation } from "@/generated/prisma/client";
import { saveLocationAction, setLocationArchivedAction } from "../actions";
import { titled } from "@/lib/metadata";

export const generateMetadata = titled("stock.locations");

const ICON = { WAREHOUSE: Warehouse, VAN: Truck, SITE: House };

export default async function LocationsPage() {
  const ctx = await getContext();
  if (!ctx.can("internal.view")) notFound();
  const t = await getTranslations();
  const format = await getFormatter();
  const canManage = ctx.can("inventory.manage");

  const [locations, members] = await Promise.all([
    ctx.db.stockLocation.findMany({
      include: {
        user: { select: { name: true } },
        stock: { where: { quantity: { gt: 0 }, part: { archivedAt: null } }, select: { quantity: true, part: { select: { purchaseCost: true } } } },
      },
      orderBy: [{ archivedAt: { sort: "asc", nulls: "first" } }, { type: "asc" }, { name: "asc" }],
    }),
    canManage
      ? ctx.db.membership.findMany({
          where: { active: true, role: { notIn: ["REQUESTER", "VIEWER", "ACCOUNTANT"] }, userId: { in: await membersWith(ctx.db, "internal.view") } },
          select: { user: { select: { id: true, name: true } } },
          orderBy: { user: { name: "asc" } },
        })
      : [],
  ]);
  const money = (n: number) => format.number(n, { style: "currency", currency: ctx.organization.currency });

  const fields = (l?: StockLocation) => (
    <>
      <Field label={t("common.name")}>
        <Input name="name" defaultValue={l?.name} required placeholder={t("stock.locationNamePlaceholder")} />
        <FieldError name="name" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("vendors.type")}>
          <Select name="type" defaultValue={l?.type ?? "VAN"}>
            {Object.values(StockLocationType).map((v) => (
              <option key={v} value={v}>
                {t(`locationType.${v}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("stock.driver")} hint={t("stock.driverHint")}>
          <Select name="userId" defaultValue={l?.userId ?? ""}>
            <option value="">—</option>
            {members.map((m) => (
              <option key={m.user.id} value={m.user.id}>
                {m.user.name}
              </option>
            ))}
          </Select>
          <FieldError name="userId" />
        </Field>
      </div>
    </>
  );

  return (
    <>
      <BackLink href="/parts" label={t("nav.parts")} />
      <PageHeader title={t("stock.locations")} description={t("stock.locationsDescription")} />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <ul className="space-y-3">
          {locations.map((l) => {
            const Icon = ICON[l.type];
            const units = l.stock.reduce((s, r) => s + Number(r.quantity), 0);
            const value = l.stock.reduce((s, r) => s + Number(r.quantity) * Number(r.part.purchaseCost), 0); // at cost
            return (
              <li key={l.id}>
                <Card className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="rounded-md bg-gray-100 p-2 text-muted">
                        <Icon className="size-5" />
                      </span>
                      <div>
                        <Link href={`/parts?location=${l.id}`} className="font-medium hover:text-brand">
                          {l.name}
                        </Link>
                        {l.archivedAt && <Badge className="ml-2">{t("common.archived")}</Badge>}
                        <div className="text-xs text-muted">
                          {t(`locationType.${l.type}`)}
                          {l.user && ` · ${l.user.name}`}
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="tabular-nums">{t("stock.partCount", { count: l.stock.length })}</div>
                      <div className="text-xs text-muted tabular-nums">
                        {format.number(units)} {t("stock.units")} · {money(value)}
                      </div>
                    </div>
                  </div>
                  {canManage && (
                    <div className="mt-3 flex flex-wrap items-start gap-2">
                      <details className="flex-1 rounded-md border border-border p-3 [&_summary]:cursor-pointer">
                        <summary className="text-sm font-medium">{t("common.edit")}</summary>
                        <ActionForm action={saveLocationAction.bind(null, l.id)} successMessage={t("common.saved")} className="mt-3">
                          {fields(l)}
                        </ActionForm>
                      </details>
                      <ArchiveButton archived={!!l.archivedAt} action={setLocationArchivedAction.bind(null, l.id)} />
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>

        {canManage && (
          <Card className="h-fit p-5">
            <h2 className="mb-3 font-medium">{t("stock.newLocation")}</h2>
            <ActionForm action={saveLocationAction.bind(null, null)} submitLabel={t("common.create")} successMessage={t("common.saved")}>
              {fields()}
            </ActionForm>
          </Card>
        )}
      </div>
    </>
  );
}
