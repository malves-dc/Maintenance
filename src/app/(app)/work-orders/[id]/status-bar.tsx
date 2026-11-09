"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Car, CheckCircle2, CirclePause, CirclePlay, CircleDot, CircleX } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkOrderStatus } from "@/generated/prisma/enums";
import { setStatusAction } from "../actions";

const STATUSES: { status: WorkOrderStatus; icon: typeof CircleDot; active: string }[] = [
  { status: "OPEN", icon: CircleDot, active: "border-sky-300 bg-sky-50 text-sky-800" },
  { status: "EN_ROUTE", icon: Car, active: "border-violet-300 bg-violet-50 text-violet-800" },
  { status: "IN_PROGRESS", icon: CirclePlay, active: "border-indigo-300 bg-indigo-50 text-indigo-800" },
  { status: "ON_HOLD", icon: CirclePause, active: "border-amber-300 bg-amber-50 text-amber-800" },
  { status: "DONE", icon: CheckCircle2, active: "border-green-300 bg-green-50 text-green-800" },
];

export function StatusBar({ id, status, canExecute }: { id: string; status: WorkOrderStatus; canExecute: boolean }) {
  const t = useTranslations();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [holdNote, setHoldNote] = useState<string | null>(null);

  const go = (to: WorkOrderStatus, note?: string) =>
    start(async () => {
      setError(null);
      const res = await setStatusAction(id, to, note);
      if (res.error) setError(t(res.error as never));
      setHoldNote(null);
    });

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {STATUSES.map(({ status: s, icon: Icon, active }) => (
          <button
            key={s}
            type="button"
            disabled={!canExecute || pending || s === status}
            onClick={() => (s === "ON_HOLD" ? setHoldNote("") : go(s))}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition",
              s === status ? active : "border-border bg-surface text-muted hover:text-foreground disabled:hover:text-muted",
              !canExecute && s !== status && "opacity-50",
            )}
          >
            <Icon className="size-4" />
            {t(`woStatus.${s}`)}
          </button>
        ))}
      </div>
      {holdNote !== null && (
        <div className="mt-2 flex gap-2">
          <input
            autoFocus
            value={holdNote}
            onChange={(e) => setHoldNote(e.target.value)}
            placeholder={t("wo.holdReason")}
            className="h-9 flex-1 rounded-md border border-border px-3 text-sm"
          />
          <button type="button" className="rounded-md bg-amber-600 px-3 text-sm font-medium text-white" onClick={() => go("ON_HOLD", holdNote)}>
            {t("woStatus.ON_HOLD")}
          </button>
        </div>
      )}
      {status !== "CANCELLED" && canExecute && (
        <button
          type="button"
          disabled={pending}
          onClick={() => confirm(t("wo.cancelConfirm")) && go("CANCELLED")}
          className="mt-2 inline-flex items-center gap-1 text-xs text-muted hover:text-danger"
        >
          <CircleX className="size-3.5" />
          {t("wo.cancelWo")}
        </button>
      )}
      {error && <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
