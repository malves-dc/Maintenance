import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui";
import { getContext } from "@/lib/context";
import { HoursTabs } from "./tabs";

// Installed from these pages, the app gets the Hours icon and opens on /hours (see manifest.webmanifest/route.ts).
// No title here: one would stop the app's "· <name>" template reaching the pages below.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return {
    manifest: "/hours/manifest.webmanifest",
    appleWebApp: { capable: true, title: t("nav.hours"), statusBarStyle: "default" },
    icons: { apple: "/icons/hours-apple.png" },
  };
}

/** The Hours section, inside the app like any other: a header and its tabs, then the page. */
export default async function HoursLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getContext();
  const t = await getTranslations();
  if (!ctx.can("timesheets.log") && !ctx.can("timesheets.manage")) notFound();

  const tabs = [
    ...(ctx.can("timesheets.log") ? [{ href: "/hours", label: t("hours.tabs.today") }] : []),
    { href: "/hours/entries", label: t("hours.tabs.entries") },
    ...(ctx.can("timesheets.manage")
      ? [
          { href: "/hours/team", label: t("hours.tabs.team") },
          { href: "/hours/report", label: t("hours.tabs.report") },
        ]
      : []),
    ...(ctx.can("org.manage") ? [{ href: "/hours/settings", label: t("hours.tabs.settings") }] : []),
  ];

  return (
    <>
      <PageHeader title={t("nav.hours")} description={t("hours.description")} />
      <HoursTabs tabs={tabs} />
      {children}
    </>
  );
}
