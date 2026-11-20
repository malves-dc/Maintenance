import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Pencil, Wrench } from "lucide-react";
import { ConfirmIconButton } from "@/components/confirm-button";
import { Card } from "@/components/ui";
import type { HoursRow } from "@/lib/timesheet";
import { formatMinutes } from "@/lib/timesheet-rules";
import { deleteEntryAction } from "./actions";

/**
 * A list of hours (typed here) and work-order time (read-only, with a link to its work order when the reader can
 * open work orders). `editable(row)` says which hours entries may still be changed.
 */
export async function EntryRows({
  rows,
  showUser = false,
  showDate = false,
  editable,
  linkWorkOrders,
  next,
}: {
  rows: HoursRow[];
  showUser?: boolean;
  showDate?: boolean;
  editable: (r: HoursRow) => boolean;
  linkWorkOrders: boolean;
  next: string;
}) {
  const t = await getTranslations("hours");
  return (
    <Card className="divide-y divide-border">
      {rows.map((r) => {
        const range = r.startTime ? `${r.startTime}–${r.endTime ?? "…"}` : null;
        const canEdit = r.kind === "hours" && editable(r);
        return (
          <div key={`${r.kind}-${r.id}`} className="flex items-start gap-3 px-4 py-3">
            <div className="w-24 shrink-0 pt-0.5 text-right">
              <div className="font-semibold tabular-nums">{formatMinutes(r.minutes)}</div>
              {range && <div className="whitespace-nowrap text-xs text-muted tabular-nums">{range}</div>}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 text-sm font-medium">
                <span className="truncate">{r.villaCode ? `${r.villaCode} · ${r.villaName}` : (r.villaName ?? t("noVilla"))}</span>
                {r.kind === "wo" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-700">
                    <Wrench className="size-3" /> {t("workOrder")}
                  </span>
                )}
              </div>
              <div className="text-xs text-muted">
                {[showDate ? r.date.split("-").reverse().join("/") : null, showUser ? r.userName : null].filter(Boolean).join(" · ")}
              </div>
              <p className="mt-0.5 whitespace-pre-line break-words text-sm text-gray-700">
                {r.kind === "wo" && linkWorkOrders && r.workOrderId ? (
                  <Link href={`/work-orders/${r.workOrderId}`} className="hover:underline">
                    {r.description}
                  </Link>
                ) : (
                  r.description
                )}
              </p>
            </div>
            {canEdit && (
              <div className="flex shrink-0 items-center gap-1">
                <Link href={`/horas/${r.id}?next=${encodeURIComponent(next)}`} title={t("edit")} aria-label={t("edit")} className="rounded p-1.5 text-muted hover:bg-gray-100 hover:text-foreground">
                  <Pencil className="size-4" />
                </Link>
                <ConfirmIconButton action={deleteEntryAction.bind(null, r.id)} title={t("delete")} confirmText={t("deleteConfirm")} />
              </div>
            )}
          </div>
        );
      })}
    </Card>
  );
}
