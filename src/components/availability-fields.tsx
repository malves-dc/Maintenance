"use client";

import { useTranslations } from "next-intl";
import { FieldError } from "@/components/action-form";
import { DateTimeField } from "@/components/datetime-field";
import { Field } from "@/components/ui";

/** Optional "the work can be done between … and …" period on a client request (portal and QR form). */
export function AvailabilityFields() {
  const t = useTranslations("requests");
  return (
    <fieldset>
      <legend className="text-sm font-medium">{t("windowTitle")}</legend>
      <p className="mb-2 text-xs text-muted">{t("windowHint")}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("windowFrom")}>
          <DateTimeField name="availableFrom" />
          <FieldError name="availableFrom" />
        </Field>
        <Field label={t("windowTo")}>
          <DateTimeField name="availableTo" />
          <FieldError name="availableTo" />
        </Field>
      </div>
    </fieldset>
  );
}
