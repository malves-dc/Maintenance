"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Play, Square } from "lucide-react";
import { FieldError, FieldErrorsProvider } from "@/components/action-form";
import { Button, Card, FormError, Input } from "@/components/ui";
import { useActionForm } from "@/lib/use-action-form";
import { discardTimerAction, startTimerAction, stopTimerAction } from "./actions";
import { VillaSelect, type VillaOption } from "./villa-select";

export type RunningTimer = { villa: string; startedAt: string; description: string | null } | null;

function Elapsed({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const s = Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000));
  const hh = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return <span className="tabular-nums" suppressHydrationWarning>{`${hh}:${mm}:${ss}`}</span>;
}

/** Start a timer at a villa, or stop the running one (which logs the time). */
export function TimerCard({ timer, villas, startedLabel }: { timer: RunningTimer; villas: { recent: VillaOption[]; all: VillaOption[] }; startedLabel: string | null }) {
  const t = useTranslations();
  const [startState, start, starting] = useActionForm(startTimerAction);
  const [stopState, stop, stopping] = useActionForm(stopTimerAction);
  const [discarding, startDiscard] = useTransition();
  const error = (code?: string) => (!code ? null : code === "validation" ? t("common.checkFields") : t.has(code as never) ? t(code as never) : t("common.somethingWrong"));

  if (timer) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <span className="relative flex size-3">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-75" />
            <span className="relative inline-flex size-3 rounded-full bg-brand" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{timer.villa}</div>
            <div className="text-xs text-muted">{startedLabel}</div>
          </div>
          <div className="text-2xl font-semibold">
            <Elapsed since={timer.startedAt} />
          </div>
        </div>
        <FieldErrorsProvider errors={stopState?.fieldErrors}>
          <form onSubmit={stop} className="mt-3 space-y-2">
            <Input name="description" defaultValue={timer.description ?? ""} placeholder={t("hours.whatDone")} maxLength={4000} />
            <FieldError name="description" />
            <FormError message={error(stopState?.error)} />
            <div className="flex gap-2">
              <Button disabled={stopping} className="flex-1">
                <Square className="size-4" /> {t("hours.stopTimer")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={discarding}
                onClick={() => confirm(t("hours.discardConfirm")) && startDiscard(() => discardTimerAction())}
              >
                {t("hours.discard")}
              </Button>
            </div>
          </form>
        </FieldErrorsProvider>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <FieldErrorsProvider errors={startState?.fieldErrors}>
        <form onSubmit={start} className="space-y-2">
          <div className="text-sm font-medium">{t("hours.timer")}</div>
          <VillaSelect recent={villas.recent} all={villas.all} />
          <FieldError name="villaId" />
          <Input name="description" placeholder={t("hours.descriptionOptional")} maxLength={4000} />
          <FormError message={error(startState?.error)} />
          <Button disabled={starting} className="w-full">
            <Play className="size-4" /> {t("hours.startTimer")}
          </Button>
        </form>
      </FieldErrorsProvider>
    </Card>
  );
}
