import "server-only";
import { onMeterReading } from "@/lib/pm";
import { ACTIVE_STATUSES, createWorkOrder, type WoCtx } from "@/lib/work-orders";
import { membersWith, notify } from "@/lib/notify";
import { docRef } from "@/lib/series";

export function isOutOfRange(m: { lowerLimit: number | null; upperLimit: number | null }, value: number) {
  return (m.lowerLimit !== null && value < m.lowerLimit) || (m.upperLimit !== null && value > m.upperLimit);
}

/**
 * Records a reading and runs its consequences: meter-triggered PMs, and — for meters with
 * `alertWorkOrder` — a corrective WO when the value is out of range (only if none is open).
 */
export async function recordReading(ctx: WoCtx, meterId: string, value: number, workOrderId?: string | null) {
  const meter = await ctx.db.meter.findUnique({ where: { id: meterId }, include: { asset: { select: { id: true, name: true } } } });
  if (!meter) throw new Error("Meter not found");
  const now = new Date();
  await ctx.db.meterReading.create({ data: { meterId, value, userId: ctx.user.id, workOrderId: workOrderId ?? null, createdAt: now } });
  await ctx.db.meter.update({ where: { id: meterId }, data: { lastValue: value, lastReadAt: now } });

  const pmCreated = await onMeterReading(ctx, meterId, value);

  let alertWorkOrderId: string | null = null;
  const outOfRange = isOutOfRange(meter, value);
  if (outOfRange && meter.alertWorkOrder) {
    const open = await ctx.db.workOrder.findFirst({ where: { alertMeterId: meterId, status: { in: ACTIVE_STATUSES } } });
    if (!open) {
      const wo = await createWorkOrder(ctx, {
        title: `${meter.asset.name}: ${meter.name} ${value} ${meter.unit}`,
        description: [
          meter.lowerLimit !== null ? `≥ ${meter.lowerLimit} ${meter.unit}` : null,
          meter.upperLimit !== null ? `≤ ${meter.upperLimit} ${meter.unit}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        type: "CORRECTIVE",
        priority: "HIGH",
        assetId: meter.asset.id,
        alertMeterId: meterId,
      });
      alertWorkOrderId = wo.id;
      await notify(ctx, await membersWith(ctx.db, "workOrders.manage"), {
        type: "METER_ALERT",
        data: { asset: meter.asset.name, meter: meter.name, value, unit: meter.unit, number: docRef(wo) },
        link: `/work-orders/${wo.id}`,
      });
    }
  }
  return { outOfRange, pmCreated, alertWorkOrderId };
}
