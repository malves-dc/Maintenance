"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Check, Pencil, X } from "lucide-react";
import { Input } from "@/components/ui";
import { useActionForm } from "@/lib/use-action-form";
import type { FormResult } from "@/lib/forms";
import { renameMemberAction } from "./actions";

/** A member's name with a pencil to rename them in place (Settings → Staff / Clients). `children` follow the name (e.g. "(you)"). */
export function MemberName({ id, name, children }: { id: string; name: string; children?: ReactNode }) {
  const t = useTranslations();
  const [editing, setEditing] = useState(false);
  const [state, onSubmit, pending] = useActionForm(async (prev: FormResult, form: FormData) => {
    const r = await renameMemberAction(id, prev, form);
    if (r?.ok) setEditing(false);
    return r;
  });

  if (!editing)
    return (
      <div className="group flex items-center gap-1 font-medium">
        <span>
          {name} {children}
        </span>
        <button type="button" title={t("settings.rename")} aria-label={t("settings.rename")} onClick={() => setEditing(true)} className="rounded p-1 text-muted hover:bg-gray-100 hover:text-foreground">
          <Pencil className="size-3.5" />
        </button>
      </div>
    );

  const code = state?.fieldErrors?.name;
  const error = code ? (t.has(`validation.${code}` as never) ? t(`validation.${code}` as never) : t("validation.invalid")) : state?.error ? t("common.somethingWrong") : null;
  return (
    <form onSubmit={onSubmit} className="space-y-1">
      <div className="flex items-center gap-1">
        <Input name="name" defaultValue={name} required maxLength={100} autoFocus disabled={pending} aria-label={t("common.name")} className="h-8 max-w-56" onKeyDown={(e) => e.key === "Escape" && setEditing(false)} />
        <button type="submit" title={t("common.save")} aria-label={t("common.save")} disabled={pending} className="rounded p-1.5 text-brand hover:bg-gray-100">
          <Check className="size-4" />
        </button>
        <button type="button" title={t("common.cancel")} aria-label={t("common.cancel")} disabled={pending} onClick={() => setEditing(false)} className="rounded p-1.5 text-muted hover:bg-gray-100">
          <X className="size-4" />
        </button>
      </div>
      {error && <span className="block text-xs text-danger">{error}</span>}
    </form>
  );
}
