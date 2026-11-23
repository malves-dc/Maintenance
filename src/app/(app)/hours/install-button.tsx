"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Download, X } from "lucide-react";
import { Button, Card } from "@/components/ui";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISSED = "hours-install-dismissed";
const noop = () => () => {};

function wasDismissed() {
  try {
    return localStorage.getItem(DISMISSED) === "1";
  } catch {
    return false;
  }
}
/** Opened from an installed icon. */
const standalone = () => matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
/** iPhone / iPad: no install prompt, so the steps are shown instead. */
const apple = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/**
 * Offers the Hours icon for the home screen: the browser's own install prompt where there is one (Android, desktop
 * Chrome/Edge), else the steps for iPhone/iPad. Hidden once installed, when opened from an icon, or when dismissed.
 */
export function InstallHours() {
  const t = useTranslations("hours.install");
  // Device checks run only in the browser (null while rendering on the server).
  const skip = useSyncExternalStore(noop, () => wasDismissed() || standalone(), () => true);
  const ios = useSyncExternalStore(noop, apple, () => false);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault(); // keep it for our button
      setPrompt(e as InstallPrompt);
    };
    const onInstalled = () => setClosed(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (skip || closed || (!prompt && !ios)) return null;
  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED, "1");
    } catch {}
    setClosed(true);
  };

  return (
    <Card className="flex items-start gap-3 p-3 text-sm">
      <Download className="mt-0.5 size-5 shrink-0 text-brand" />
      <div className="min-w-0 flex-1 space-y-2">
        <p className="font-medium">{t("title")}</p>
        {prompt ? (
          <Button
            size="sm"
            onClick={async () => {
              await prompt.prompt();
              const { outcome } = await prompt.userChoice;
              setPrompt(null);
              if (outcome === "accepted") setClosed(true);
            }}
          >
            {t("button")}
          </Button>
        ) : (
          <p className="text-muted">{t("ios")}</p>
        )}
      </div>
      <button type="button" onClick={dismiss} title={t("dismiss")} aria-label={t("dismiss")} className="rounded p-1 text-muted hover:bg-gray-100">
        <X className="size-4" />
      </button>
    </Card>
  );
}
