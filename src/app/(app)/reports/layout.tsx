import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui";
import { getContext } from "@/lib/context";
import { SystemType } from "@/generated/prisma/enums";
import { ReportNav } from "./report-nav";
import { titled } from "@/lib/metadata";

export const generateMetadata = titled("nav.reports");

export default async function ReportsLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getContext();
  if (!ctx.can("reports.view")) notFound();
  const t = await getTranslations();
  const [clients, villas] = await Promise.all([
    ctx.db.client.findMany({ where: { archivedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    ctx.db.villa.findMany({ where: { archivedAt: null }, select: { id: true, name: true, clientId: true, managerId: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title={t("nav.reports")} description={t("reports.description")} />
      <ReportNav clients={clients} villas={villas} systems={Object.values(SystemType)} showCosts={ctx.can("costs.view")} />
      {children}
    </>
  );
}
