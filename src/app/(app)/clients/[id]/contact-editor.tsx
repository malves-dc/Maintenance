"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import { Button, Field, FormError, Input } from "@/components/ui";
import { FieldError, FieldErrorsProvider } from "@/components/action-form";
import { useActionForm } from "@/lib/use-action-form";
import type { FormResult } from "@/lib/forms";
import { updateContactAction } from "../actions";

export type EditableContactData = { id: string; name: string; role: string | null; email: string | null; phone: string | null; isPrimary: boolean; receivesReports: boolean };

/**
 * A client contact as shown on the client page (`children`), with a pencil that turns it into a form in place.
 * `actions` (e.g. the remove button) sit next to the pencil.
 */
export function EditableContact({ clientId, contact, actions, children }: { clientId: string; contact: EditableContactData; actions?: ReactNode; children: ReactNode }) {
  const t = useTranslations();
  const [editing, setEditing] = useState(false);
  const [state, onSubmit, pending] = useActionForm(async (prev: FormResult, form: FormData) => {
    const r = await updateContactAction(clientId, contact.id, prev, form);
    if (r?.ok) setEditing(false);
    return r;
  });

  if (!editing)
    return (
      <div className="flex items-start justify-between gap-2">
        {children}
        <div className="flex shrink-0 items-center">
          <button type="button" title={t("common.edit")} aria-label={t("common.edit")} onClick={() => setEditing(true)} className="rounded p-1 text-muted hover:bg-gray-100">
            <Pencil className="size-3.5" />
          </button>
          {actions}
        </div>
      </div>
    );

  return (
    <FieldErrorsProvider errors={state?.fieldErrors}>
      <form onSubmit={onSubmit} className="space-y-3 rounded-md border border-border p-3">
        <fieldset disabled={pending} className="space-y-3">
          <Field label={t("common.name")}>
            <Input name="name" defaultValue={contact.name} required maxLength={150} autoFocus />
            <FieldError name="name" />
          </Field>
          <Field label={t("clients.contactRole")}>
            <Input name="role" defaultValue={contact.role ?? ""} maxLength={100} placeholder={t("clients.contactRolePlaceholder")} />
            <FieldError name="role" />
          </Field>
          <Field label={t("common.phone")}>
            <Input name="phone" type="tel" defaultValue={contact.phone ?? ""} maxLength={50} />
            <FieldError name="phone" />
          </Field>
          <Field label={t("common.email")}>
            <Input name="email" type="email" defaultValue={contact.email ?? ""} maxLength={200} />
            <FieldError name="email" />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isPrimary" defaultChecked={contact.isPrimary} className="size-4 accent-brand" />
            {t("clients.primaryCheckbox")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="receivesReports" defaultChecked={contact.receivesReports} className="size-4 accent-brand" />
            {t("reportEmail.contactCheckbox")}
          </label>
        </fieldset>
        <FormError message={state?.error ? (state.error === "validation" ? t("common.checkFields") : t("common.somethingWrong")) : null} />
        <div className="flex items-center gap-2">
          <Button size="sm" disabled={pending}>
            {t("common.save")}
          </Button>
          <Button size="sm" type="button" variant="ghost" disabled={pending} onClick={() => setEditing(false)}>
            {t("common.cancel")}
          </Button>
        </div>
      </form>
    </FieldErrorsProvider>
  );
}
