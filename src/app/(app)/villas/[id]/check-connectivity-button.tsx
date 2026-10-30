"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

/** "Check now": `action` is the bound checkConnectivityAction. */
export function CheckConnectivityButton({ action }: { action: () => Promise<void> }) {
  const t = useTranslations("connectivity");
  const [pending, start] = useTransition();
  return (
    <Button variant="secondary" disabled={pending} onClick={() => start(() => action())} className="w-full">
      <RefreshCw className={cn("size-4", pending && "animate-spin")} />
      {pending ? t("checking") : t("checkNow")}
    </Button>
  );
}
