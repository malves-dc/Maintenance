"use client";

import { useTranslations } from "next-intl";
import { Send } from "lucide-react";
import { FieldError, FieldErrorsProvider } from "@/components/action-form";
import { Button, FormError, Textarea } from "@/components/ui";
import { useActionForm } from "@/lib/use-action-form";
import type { Recipient } from "@/lib/report-recipients";
import { sendReportAction } from "../actions";

/** E-mail the PDF service report: default recipients ticked, untick or add more, then send. */
export function SendReportPanel({
  woId,
  recipients,
  lastSent,
}: {
  woId: string;
  // sentOn: the days (dd/mm/yyyy) the report was e-mailed to that address.
  recipients: (Recipient & { sentOn: string[] })[];
  lastSent: { at: string; count: number } | null;
}) {
  const t = useTranslations();
  const [state, submit, pending] = useActionForm(sendReportAction.bind(null, woId));
  const error = state?.error && state.error !== "validation" ? (t.has(state.error) ? t(state.error) : t("common.somethingWrong")) : null;

  return (
    <FieldErrorsProvider errors={state?.fieldErrors}>
      <form method="post" onSubmit={submit} className="space-y-3 text-sm">
        {recipients.length === 0 ? (
          <p className="text-muted">{t("reportEmail.noDefaults")}</p>
        ) : (
          <ul className="space-y-1.5">
            {recipients.map((r) => (
              <li key={r.email}>
                <label className="flex items-start gap-2">
                  <input type="checkbox" name="to" value={r.email} defaultChecked={r.source !== "previous"} className="mt-0.5 size-4 accent-brand" />
                  <span className="min-w-0">
                    <span className="block truncate">{r.name ? `${r.name} · ${r.email}` : r.email}</span>
                    <span className="block text-xs text-muted">{t(`reportEmail.source.${r.source}`)}</span>
                    {r.sentOn.length > 0 && <span className="block text-xs text-green-700">{t("reportEmail.sentOn", { dates: r.sentOn.join(", ") })}</span>}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
        <div>
          <label className="mb-1 block text-xs text-muted" htmlFor={`extra-${woId}`}>
            {t("reportEmail.extra")}
          </label>
          <Textarea id={`extra-${woId}`} name="extra" className="min-h-16" placeholder="nome@exemplo.pt" />
          <FieldError name="extra" />
        </div>
        <FormError message={error} />
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" disabled={pending}>
            <Send className="size-4" />
            {pending ? t("reportEmail.sending") : t("reportEmail.send")}
          </Button>
          {state?.ok && <span className="text-xs text-green-700">{t("reportEmail.sent")}</span>}
        </div>
        {lastSent && <p className="text-xs text-muted">{t("reportEmail.lastSent", { at: lastSent.at, count: lastSent.count })}</p>}
      </form>
    </FieldErrorsProvider>
  );
}
