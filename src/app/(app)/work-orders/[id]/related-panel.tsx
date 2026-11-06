"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { ActionForm, FieldError } from "@/components/action-form";
import { WorkOrderStatusBadge } from "@/components/badges";
import { Input } from "@/components/ui";
import type { WorkOrderStatus } from "@/generated/prisma/enums";
import { addWorkOrderLinkAction, removeWorkOrderLinkAction } from "../actions";

type RelatedLink = { id: string; woId: string; ref: string; title: string; status: WorkOrderStatus };

/** Other jobs this one is related to (a recurring problem, say). Shown on both, and in the service report. */
export function RelatedPanel({ woId, canEdit, links, suggestions }: { woId: string; canEdit: boolean; links: RelatedLink[]; suggestions: { ref: string; title: string }[] }) {
  const t = useTranslations();
  const [pending, start] = useTransition();
  if (!canEdit && links.length === 0) return null;
  return (
    <div className="mt-4 border-t border-border pt-4 text-sm">
      <h3 className="mb-2 font-medium">{t("wo.related")}</h3>
      {links.length > 0 && (
        <ul className="mb-2 divide-y divide-border">
          {links.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-2 py-1.5">
              <Link href={`/work-orders/${l.woId}`} className="min-w-0 truncate hover:text-brand">
                <span className="mr-1.5 font-mono text-xs text-muted">{l.ref}</span>
                {l.title}
              </Link>
              <span className="flex shrink-0 items-center gap-1">
                <WorkOrderStatusBadge status={l.status} />
                {canEdit && (
                  <button
                    type="button"
                    className="rounded p-1 text-muted hover:text-danger"
                    title={t("wo.relatedRemove")}
                    aria-label={t("wo.relatedRemove")}
                    disabled={pending}
                    onClick={() => start(() => removeWorkOrderLinkAction(woId, l.id))}
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        // Re-created after each link, so the box starts empty.
        <ActionForm key={links.length} action={addWorkOrderLinkAction.bind(null, woId)} submitLabel={t("common.add")}>
          <p className="text-xs text-muted">{t("wo.relatedHint")}</p>
          <Input name="ref" list={`related-${woId}`} required maxLength={30} placeholder="2026-12" aria-label={t("wo.relatedNumber")} className="w-40" />
          <datalist id={`related-${woId}`}>
            {suggestions.map((s) => (
              <option key={s.ref} value={s.ref}>
                {s.title}
              </option>
            ))}
          </datalist>
          <FieldError name="ref" />
        </ActionForm>
      )}
    </div>
  );
}
