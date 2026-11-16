import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card, PageHeader } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { getContext } from "@/lib/context";
import { sp } from "@/lib/list";
import { VillaForm } from "../villa-form";
import { villaOffices } from "@/lib/offices";

export default async function NewVillaPage({ searchParams }: PageProps<"/villas/new">) {
  const ctx = await getContext();
  if (!ctx.can("clients.manage")) notFound();
  const t = await getTranslations();
  const clients = await ctx.db.client.findMany({
    where: { archivedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return (
    <>
      <BackLink href="/villas" label={t("nav.villas")} />
      <PageHeader title={t("villas.new")} />
      <Card className="max-w-3xl p-6">
        <VillaForm clients={clients} offices={await villaOffices(ctx.db, null)} defaultClientId={sp(await searchParams, "clientId")} />
      </Card>
    </>
  );
}
