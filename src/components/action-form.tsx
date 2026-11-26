"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useActionForm } from "@/lib/use-action-form";
import { useTranslations } from "next-intl";
import { Button, FormError } from "@/components/ui";
import type { FormResult } from "@/lib/forms";
import { cn } from "@/lib/utils";

const FieldErrorsContext = createContext<Record<string, string> | undefined>(undefined);

/**
 * Wraps a server action (`(prev, formData) => FormResult`) with pending state and error display.
 * Children can be server-rendered inputs; use <FieldError name> next to an input to show its error.
 * On success the action normally redirects; `successMessage` shows a note if it doesn't, and `onSuccess` runs.
 */
export function ActionForm({
  action,
  children,
  submitLabel,
  className,
  successMessage,
  footer,
  onSuccess,
}: {
  action: (prev: FormResult, form: FormData) => Promise<FormResult>;
  children: ReactNode;
  submitLabel?: string;
  className?: string;
  successMessage?: string;
  footer?: ReactNode;
  onSuccess?: () => void;
}) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionForm(action);
  useEffect(() => {
    if (state?.ok) onSuccess?.();
  }, [state, onSuccess]);
  // Error codes are message keys: "somethingWrong" (under common) or namespaced like "wo.invalidRef".
  const errorText = (code: string) =>
    t.has(`common.${code}` as never) ? t(`common.${code}` as never) : t.has(code as never) ? t(code as never) : t("common.somethingWrong");
  const generic = !state?.error ? null : state.error === "validation" ? t("common.checkFields") : errorText(state.error);

  return (
    <FieldErrorsContext.Provider value={state?.fieldErrors}>
      <form method="post" onSubmit={formAction} className={cn("space-y-4", className)}>
        <fieldset disabled={pending} className="space-y-4">
          {children}
        </fieldset>
        <FormError message={generic} />
        <div className="flex items-center gap-3">
          <Button disabled={pending}>{submitLabel ?? t("common.save")}</Button>
          {state?.ok && successMessage && <span className="text-sm text-green-700">{successMessage}</span>}
          {footer}
        </div>
      </form>
    </FieldErrorsContext.Provider>
  );
}

/** For custom forms (not ActionForm) that still want <FieldError> messages. */
export function FieldErrorsProvider({ errors, children }: { errors?: Record<string, string>; children: ReactNode }) {
  return <FieldErrorsContext.Provider value={errors}>{children}</FieldErrorsContext.Provider>;
}

export function FieldError({ name }: { name: string }) {
  const t = useTranslations("validation");
  const errors = useContext(FieldErrorsContext);
  const code = errors?.[name];
  if (!code) return null;
  return <span className="block text-xs text-danger">{t.has(code as never) ? t(code as never) : t("invalid")}</span>;
}
