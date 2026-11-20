"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { RefreshCw, Star } from "lucide-react";
import { Button, Select } from "@/components/ui";
import type { RefreshResult } from "@/lib/offices";
import { addOfficeMemberAction, refreshAllDistancesAction, setRoadDistancesAction } from "./actions";

export function AddOfficeMember({ officeId, options }: { officeId: string; options: { id: string; name: string }[] }) {
  const t = useTranslations();
  const [pending, start] = useTransition();
  if (options.length === 0) return null;
  return (
    <Select
      aria-label={t("offices.addPerson")}
      className="h-8"
      value=""
      disabled={pending}
      onChange={(e) => e.target.value && start(() => addOfficeMemberAction(officeId, e.target.value))}
    >
      <option value="">+ {t("offices.addPerson")}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </Select>
  );
}

export function PrimaryButton({ action }: { action: () => Promise<void> }) {
  const t = useTranslations();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      title={t("offices.makePrimary")}
      aria-label={t("offices.makePrimary")}
      disabled={pending}
      onClick={() => start(() => action())}
      className="rounded p-0.5 text-muted hover:bg-gray-100 hover:text-brand disabled:opacity-50"
    >
      <Star className="size-3.5" />
    </button>
  );
}

/** Straight-line estimate or road distances (OSRM), and recalculating every distance not typed by hand. */
export function DistanceSettings({ road, server, hasOffices }: { road: boolean; server: string; hasOffices: boolean }) {
  const t = useTranslations();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<RefreshResult | null>(null);
  const run = (fn: () => Promise<RefreshResult>) => start(async () => setResult(await fn()));
  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted">{t("offices.distancesExplained")}</p>
      <label className="flex items-start gap-2">
        <input type="checkbox" className="mt-1" checked={road} disabled={pending} onChange={(e) => run(() => setRoadDistancesAction(e.target.checked))} />
        <span>
          <span className="font-medium">{t("offices.roadDistances")}</span>
          <span className="block text-xs text-muted">{t("offices.roadDistancesHint", { server })}</span>
        </span>
      </label>
      {hasOffices && (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={() => run(refreshAllDistancesAction)}>
            <RefreshCw className={pending ? "size-4 animate-spin" : "size-4"} />
            {t("offices.recalculate")}
          </Button>
          {result && (
            <span className={result.failed ? "text-danger" : "text-green-700"}>
              {t("offices.recalculated", { road: result.road, estimated: result.estimated })}
              {result.failed && ` ${t("offices.roadFailed")}`}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
