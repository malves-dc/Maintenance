"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Lock, LockOpen } from "lucide-react";
import { Button } from "@/components/ui";
import { setVillaBlockedAction } from "../actions";

/** Block / unblock a villa (villas.block): while blocked, no work orders can be created for it. */
export function BlockVillaButton({ id, blocked }: { id: string; blocked: boolean }) {
  const t = useTranslations("villas");
  const [pending, start] = useTransition();
  return (
    <Button
      variant="secondary"
      disabled={pending}
      onClick={() => confirm(t(blocked ? "unblockConfirm" : "blockConfirm")) && start(() => setVillaBlockedAction(id, !blocked))}
    >
      {blocked ? <LockOpen className="size-4" /> : <Lock className="size-4" />}
      {t(blocked ? "unblock" : "block")}
    </Button>
  );
}
