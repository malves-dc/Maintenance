"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { FieldError, FieldErrorsProvider } from "@/components/action-form";
import { AvailabilityFields } from "@/components/availability-fields";
import { PhotoPicker } from "@/components/photo-picker";
import { Button, Field, FormError, Input, Textarea } from "@/components/ui";
import { useActionForm } from "@/lib/use-action-form";
import { cn } from "@/lib/utils";
import { publicRequestAction, type PublicResult } from "./actions";

const URGENCY = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export function PublicRequestForm({ token, privacyHref }: { token: string; privacyHref: string }) {
  const t = useTranslations();
  const [priority, setPriority] = useState<(typeof URGENCY)[number]>("MEDIUM");
  const [photos, setPhotos] = useState<File[]>([]);
  const [state, onSubmit, pending] = useActionForm(async (prev: PublicResult, form: FormData) => {
    for (const p of photos) form.append("photos", p);
    return publicRequestAction(token, prev, form);
  });

  if (state?.ok) {
    return (
      <div className="flex flex-col items-center py-6 text-center">
        <CheckCircle2 className="size-10 text-green-600" />
        <p className="mt-3 font-medium">{t("qr.thanks")}</p>
        {state.number ? <p className="mt-1 text-sm text-muted">{t("qr.reference", { number: state.number })}</p> : null}
      </div>
    );
  }

  const generic = !state?.error
    ? null
    : state.error === "validation"
      ? t("common.checkFields")
      : t.has(state.error as never)
        ? t(state.error as never)
        : t("common.somethingWrong");

  return (
    <FieldErrorsProvider errors={state?.fieldErrors}>
      <form onSubmit={onSubmit} className="space-y-4 text-left">
        {/* Honeypot for bots */}
        <input name="website" tabIndex={-1} autoComplete="off" className="absolute -left-[9999px] h-0 w-0 opacity-0" aria-hidden />
        <Field label={t("portal.whatsWrong")}>
          <Input name="title" required placeholder={t("portal.titlePlaceholder")} />
          <FieldError name="title" />
        </Field>
        <Field label={t("portal.details")}>
          <Textarea name="description" className="min-h-20" />
        </Field>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">{t("portal.urgency")}</legend>
          <input type="hidden" name="priority" value={priority} />
          <div className="grid grid-cols-2 gap-2">
            {URGENCY.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={cn(
                  "rounded-md border px-3 py-2 text-left text-sm",
                  priority === p ? (p === "URGENT" ? "border-red-400 bg-red-50 text-red-800" : "border-brand bg-brand/10 text-brand") : "border-border",
                )}
              >
                {t(`portal.urgencyLevels.${p}.label`)}
              </button>
            ))}
          </div>
        </fieldset>
        <AvailabilityFields />
        <div>
          <div className="mb-1.5 text-sm font-medium">{t("portal.photos")}</div>
          <PhotoPicker onChange={setPhotos} max={3} />
        </div>
        <div className="space-y-3 rounded-md bg-gray-50 p-3">
          <Field label={t("qr.yourName")}>
            <Input name="name" required autoComplete="name" />
            <FieldError name="name" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("common.phone")}>
              <Input name="phone" type="tel" autoComplete="tel" />
              <FieldError name="phone" />
            </Field>
            <Field label={t("common.email")}>
              <Input name="email" type="email" autoComplete="email" />
              <FieldError name="email" />
            </Field>
          </div>
          <p className="text-xs text-muted">
            {t("privacy.qrNotice")}{" "}
            <Link href={privacyHref} target="_blank" className="font-medium text-brand underline">
              {t("privacy.title")}
            </Link>
          </p>
        </div>
        <FormError message={generic} />
        <Button className="w-full" disabled={pending}>
          {pending ? t("portal.sending") : t("portal.send")}
        </Button>
      </form>
    </FieldErrorsProvider>
  );
}
