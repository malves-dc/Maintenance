import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui";
import { getContext } from "@/lib/context";
import { isHoursHost, requestHost } from "@/lib/hours-host";
import { HoursTabs } from "./tabs";

// On its own address the section installs as an app of its own (manifest under /horas). No title here: one would
// stop the app's "· <name>" template reaching the pages below.
export const metadata: Metadata = { manifest: "/horas/manifest.webmanifest" };

/** The Hours section, inside the app like any other: a header and its tabs, then the page. */
export default async function HoursLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getContext();
  const t = await getTranslations();
  if (!ctx.can("timesheets.log") && !ctx.can("timesheets.manage")) {
    // On its own address the rest of the app isn't reachable: say so rather than redirect (it would bounce back).
    if (!isHoursHost(requestHost(await headers()))) redirect("/dashboard");
    return <p className="py-12 text-center text-sm text-muted">{t("hours.noAccess")}</p>;
  }

  const tabs = [
    ...(ctx.can("timesheets.log") ? [{ href: "/horas", label: t("hours.tabs.today") }] : []),
    { href: "/horas/registos", label: t("hours.tabs.entries") },
    ...(ctx.can("timesheets.manage")
      ? [
          { href: "/horas/equipa", label: t("hours.tabs.team") },
          { href: "/horas/relatorio", label: t("hours.tabs.report") },
        ]
      : []),
    ...(ctx.can("org.manage") ? [{ href: "/horas/definicoes", label: t("hours.tabs.settings") }] : []),
  ];

  return (
    <>
      <PageHeader title={t("nav.hours")} description={t("hours.description")} />
      <HoursTabs tabs={tabs} />
      {children}
    </>
  );
}
