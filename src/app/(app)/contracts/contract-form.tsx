import { getTranslations } from "next-intl/server";
import { ActionForm, FieldError } from "@/components/action-form";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { ContractStatus, SystemType } from "@/generated/prisma/enums";
import type { ServiceContract } from "@/generated/prisma/client";
import type { AppContext } from "@/lib/context";
import { dateInput } from "@/lib/forms";
import { saveContractAction } from "./actions";
import { ClientVillaFields, type ClientOption } from "./client-villa-fields";
import { DateInput } from "@/components/date-input";

export async function ContractForm({ ctx, contract, defaults }: { ctx: AppContext; contract?: ServiceContract; defaults?: { clientId?: string } }) {
  const t = await getTranslations();
  const villaFilter = { OR: [{ archivedAt: null }, { id: contract?.villaId ?? "" }] };
  const rows = await ctx.db.client.findMany({
    where: { OR: [{ archivedAt: null }, { id: contract?.clientId ?? "" }] },
    select: {
      id: true,
      name: true,
      villas: { where: villaFilter, select: { id: true, name: true }, orderBy: { name: "asc" } },
      managedVillas: { where: villaFilter, select: { id: true, name: true, client: { select: { name: true } } }, orderBy: { name: "asc" } },
    },
    orderBy: { name: "asc" },
  });
  const clients: ClientOption[] = rows.map((c) => ({
    id: c.id,
    name: c.name,
    owned: c.villas,
    managed: c.managedVillas.map((v) => ({ id: v.id, name: v.name, owner: v.client?.name ?? null })),
  }));

  return (
    <ActionForm action={saveContractAction.bind(null, contract?.id ?? null)} submitLabel={contract ? t("common.save") : t("common.create")}>
      <Field label={t("common.name")}>
        <Input name="name" defaultValue={contract?.name} placeholder={t("contracts.namePlaceholder")} required autoFocus />
        <FieldError name="name" />
      </Field>
      <ClientVillaFields clients={clients} clientId={contract?.clientId ?? defaults?.clientId ?? ""} villaId={contract?.villaId ?? ""} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t("common.status")}>
          <Select name="status" defaultValue={contract?.status ?? "ACTIVE"}>
            {Object.values(ContractStatus).map((s) => (
              <option key={s} value={s}>
                {t(`contractStatus.${s}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("contracts.startDate")}>
          <DateInput name="startDate" defaultValue={dateInput(contract?.startDate ?? new Date())} required />
          <FieldError name="startDate" />
        </Field>
        <Field label={t("contracts.endDate")} hint={t("contracts.endDateHint")}>
          <DateInput name="endDate" defaultValue={dateInput(contract?.endDate)} />
          <FieldError name="endDate" />
        </Field>
      </div>

      <fieldset className="rounded-md bg-gray-50 p-4">
        <legend className="mb-2 px-1 text-sm font-medium">{t("contracts.sla")}</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t("contracts.responseHours")} hint={t("contracts.responseHint")}>
            <Input name="responseTimeHours" type="number" min={1} step={1} defaultValue={contract?.responseTimeHours ?? ""} />
            <FieldError name="responseTimeHours" />
          </Field>
          <Field label={t("contracts.resolutionHours")} hint={t("contracts.resolutionHint")}>
            <Input name="resolutionTimeHours" type="number" min={1} step={1} defaultValue={contract?.resolutionTimeHours ?? ""} />
            <FieldError name="resolutionTimeHours" />
          </Field>
          <Field label={t("contracts.includedVisits")} hint={t("contracts.includedVisitsHint")}>
            <Input name="includedVisits" type="number" min={0} step={1} defaultValue={contract?.includedVisits ?? ""} />
            <FieldError name="includedVisits" />
          </Field>
        </div>
        <div className="mt-4 space-y-2 text-sm">
          <label className="flex items-start gap-2">
            <input type="checkbox" name="businessHoursOnly" defaultChecked={contract?.businessHoursOnly ?? false} className="mt-0.5 size-4 accent-brand" />
            <span>
              {t("contracts.businessHoursOnly")}
              <span className="block text-xs text-muted">{t("contracts.businessHoursOnlyHint")}</span>
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" name="pauseOnHold" defaultChecked={contract?.pauseOnHold ?? true} className="mt-0.5 size-4 accent-brand" />
            <span>
              {t("contracts.pauseOnHold")}
              <span className="block text-xs text-muted">{t("contracts.pauseOnHoldHint")}</span>
            </span>
          </label>
        </div>
      </fieldset>

      {ctx.can("costs.view") && (
        <Field label={t("contracts.monthlyFee")}>
          <Input name="monthlyFee" type="number" min={0} step="0.01" defaultValue={contract?.monthlyFee != null ? Number(contract.monthlyFee) : ""} className="sm:max-w-48" />
          <FieldError name="monthlyFee" />
        </Field>
      )}

      {ctx.can("costs.view") && (
        <fieldset>
          <legend className="mb-1 text-sm font-medium">{t("urgent.contractTitle")}</legend>
          <p className="mb-2 text-xs text-muted">{t("urgent.contractHint")}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("urgent.fee", { currency: ctx.organization.currency })}>
              <Input name="urgentFee" type="number" min={0} step="0.01" defaultValue={contract?.urgentFee != null ? Number(contract.urgentFee) : ""} placeholder={String(Number(ctx.organization.urgentFee))} />
              <FieldError name="urgentFee" />
            </Field>
            <Field label={t("urgent.percent")}>
              <Input name="urgentPercent" type="number" min={0} max={500} step={1} defaultValue={contract?.urgentPercent ?? ""} placeholder={String(ctx.organization.urgentPercent)} />
              <FieldError name="urgentPercent" />
            </Field>
          </div>
        </fieldset>
      )}

      <fieldset>
        <legend className="mb-1 text-sm font-medium">{t("contracts.systems")}</legend>
        <p className="mb-2 text-xs text-muted">{t("contracts.systemsHint")}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {Object.values(SystemType).map((s) => (
            <label key={s} className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" name="systems" value={s} defaultChecked={contract?.systems.includes(s)} className="size-4 accent-brand" />
              {t(`systems.${s}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <Field label={t("common.notes")}>
        <Textarea name="notes" defaultValue={contract?.notes ?? ""} placeholder={t("contracts.notesPlaceholder")} />
      </Field>
    </ActionForm>
  );
}
