"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Pause, Play, Trash2, Zap } from "lucide-react";
import { Button } from "@/components/ui";
import { deletePMAction, generateNowAction, setPMActiveAction } from "../actions";

export function PMControls({ id, active }: { id: string; active: boolean }) {
  const t = useTranslations();
  const [pending, start] = useTransition();
  return (
    <>
      <Button variant="secondary" disabled={pending} onClick={() => confirm(t("pm.generateConfirm")) && start(async () => {
            const res = await generateNowAction(id);
            if (res?.error) alert(t(res.error as never));
          })}>
        <Zap className="size-4" />
        {t("pm.generateNow")}
      </Button>
      <Button variant="secondary" disabled={pending} onClick={() => start(() => setPMActiveAction(id, !active))}>
        {active ? <Pause className="size-4" /> : <Play className="size-4" />}
        {active ? t("pm.pause") : t("pm.resume")}
      </Button>
      <Button variant="danger" disabled={pending} title={t("common.delete")} onClick={() => confirm(t("pm.deleteConfirm")) && start(() => deletePMAction(id))}>
        <Trash2 className="size-4" />
      </Button>
    </>
  );
}
