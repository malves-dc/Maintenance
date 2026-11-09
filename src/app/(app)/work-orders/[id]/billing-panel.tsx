"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { ActionForm, FieldError } from "@/components/action-form";
import { Input } from "@/components/ui";
import { clearInvoiceAction, saveInvoiceAction } from "../actions";

/** Whether the job was invoiced and under which invoice. The company's accountant sets it (billing.manage); others only read it. */
export function BillingPanel({ woId, canManage, invoiced }: { woId: string; canManage: boolean; invoiced: { number: string | null; at: string; by: string | null } | null }) {
  const t = useTranslations();
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2 text-sm">
      {invoiced ? (
        <>
          <p className="font-medium text-green-700">{invoiced.number ? t("billing.invoicedAs", { number: invoiced.number }) : t("billing.invoiced")}</p>
          <p className="text-xs text-muted">{[invoiced.at, invoiced.by].filter(Boolean).join(" · ")}</p>
        </>
      ) : (
        <p className="text-muted">{t("billing.notInvoiced")}</p>
      )}
      {canManage && (
        <ActionForm action={saveInvoiceAction.bind(null, woId)} submitLabel={invoiced ? t("common.save") : t("billing.mark")} successMessage={invoiced ? t("common.saved") : undefined}>
          <Input name="invoiceNumber" defaultValue={invoiced?.number ?? ""} maxLength={60} placeholder={t("billing.invoiceNumber")} aria-label={t("billing.invoiceNumber")} />
          <FieldError name="invoiceNumber" />
        </ActionForm>
      )}
      {canManage && invoiced && (
        <button type="button" disabled={pending} className="text-xs text-muted hover:text-danger" onClick={() => confirm(t("billing.undoConfirm")) && start(() => clearInvoiceAction(woId))}>
          {t("billing.undo")}
        </button>
      )}
    </div>
  );
}
