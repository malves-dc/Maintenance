"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Select } from "@/components/ui";
import { cn } from "@/lib/utils";
import { DateInput } from "@/components/date-input";

const TABS = [
  { href: "/reports", key: "overview" },
  { href: "/reports/work-orders", key: "workOrders" },
  { href: "/reports/sla", key: "sla" },
  { href: "/reports/costs", key: "costs" },
  { href: "/reports/technicians", key: "technicians" },
  { href: "/reports/assets", key: "assets" },
] as const;

type Option = { id: string; name: string };

/** One filter row above everything it scopes, then the tabs (which keep the filters). */
export function ReportNav({ clients, villas, systems, showCosts }: { clients: Option[]; villas: (Option & { clientId: string | null; managerId: string | null })[]; systems: string[]; showCosts: boolean }) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const range = params.get("range") ?? "90d";
  const clientId = params.get("clientId") ?? "";

  const set = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    router.replace(`${pathname}?${next}`, { scroll: false });
  };

  return (
    <div className="mb-6 space-y-4 print:hidden">
      <div className="flex flex-wrap items-center gap-2 [&_input]:h-9 [&_select]:h-9 [&_select]:w-auto">
        <Select aria-label={t("reports.period")} value={range} onChange={(e) => set({ range: e.target.value })}>
          {(["30d", "90d", "12m", "ytd", "custom"] as const).map((r) => (
            <option key={r} value={r}>
              {t(`reports.range.${r}`)}
            </option>
          ))}
        </Select>
        {range === "custom" && (
          <>
            <DateInput aria-label={t("reports.from")} className="w-36" defaultValue={params.get("from") ?? ""} onChange={(v) => set({ from: v })} />
            <span className="text-sm text-muted">–</span>
            <DateInput aria-label={t("reports.to")} className="w-36" defaultValue={params.get("to") ?? ""} onChange={(v) => set({ to: v })} />
          </>
        )}
        <Select aria-label={t("villas.client")} value={clientId} onChange={(e) => set({ clientId: e.target.value, villaId: "" })}>
          <option value="">{t("contracts.allClients")}</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select aria-label={t("assets.villa")} value={params.get("villaId") ?? ""} onChange={(e) => set({ villaId: e.target.value })}>
          <option value="">{t("assets.allVillas")}</option>
          {villas
            .filter((v) => !clientId || v.clientId === clientId || v.managerId === clientId)
            .map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
        </Select>
        <Select aria-label={t("assets.system")} value={params.get("system") ?? ""} onChange={(e) => set({ system: e.target.value })}>
          <option value="">{t("assets.allSystems")}</option>
          {systems.map((s) => (
            <option key={s} value={s}>
              {t(`systems.${s}`)}
            </option>
          ))}
        </Select>
      </div>
      <nav className="-mb-px flex gap-1 overflow-x-auto border-b border-border">
        {TABS.filter((tab) => showCosts || tab.key !== "costs").map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={`${tab.href}${params.size ? `?${params}` : ""}`}
              className={cn(
                "whitespace-nowrap border-b-2 px-3 py-2 text-sm",
                active ? "border-brand font-medium text-brand" : "border-transparent text-muted hover:text-foreground",
              )}
            >
              {t(`reports.tabs.${tab.key}`)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
