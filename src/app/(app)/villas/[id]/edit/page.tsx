import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card, PageHeader } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { getContext } from "@/lib/context";
import { VillaForm } from "../../villa-form";
import { villaOffices } from "@/lib/offices";

export default async function EditVillaPage({ params }: PageProps<"/villas/[id]/edit">) {
  const { id } = await params;
  const ctx = await getContext();
  if (!ctx.can("clients.manage")) notFound();
  const [villa, clients, offices] = await Promise.all([
    ctx.db.villa.findUnique({ where: { id } }),
    ctx.db.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    villaOffices(ctx.db, id),
  ]);
  if (!villa) notFound();
  const t = await getTranslations();
  return (
    <>
      <BackLink href={`/villas/${id}`} label={villa.name} />
      <PageHeader title={t("common.edit")} />
      <Card className="max-w-3xl p-6">
        <VillaForm villa={villa} clients={clients} offices={offices} />
      </Card>
    </>
  );
}
