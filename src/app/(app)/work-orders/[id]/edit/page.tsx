import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card, PageHeader } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { getContext } from "@/lib/context";
import { WorkOrderForm } from "../../wo-form";
import { docRef } from "@/lib/series";

export default async function EditWorkOrderPage({ params }: PageProps<"/work-orders/[id]/edit">) {
  const { id } = await params;
  const ctx = await getContext();
  if (!ctx.can("workOrders.create")) notFound();
  const wo = await ctx.db.workOrder.findUnique({ where: { id }, include: { assignees: true, categories: { select: { id: true } } } });
  if (!wo) notFound();
  const t = await getTranslations();
  return (
    <>
      <BackLink href={`/work-orders/${id}`} label={`${docRef(wo)} ${wo.title}`} />
      <PageHeader title={t("common.edit")} />
      <Card className="max-w-4xl p-6">
        <WorkOrderForm
          ctx={ctx}
          id={wo.id}
          wo={{
            ...wo,
            dueDate: wo.dueDate?.toISOString(),
            startDate: wo.startDate?.toISOString(),
            assigneeIds: wo.assignees.map((a) => a.userId),
            categoryIds: wo.categories.map((c) => c.id),
          }}
        />
      </Card>
    </>
  );
}
