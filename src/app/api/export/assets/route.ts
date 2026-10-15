import { getTranslations } from "next-intl/server";
import { getContext } from "@/lib/context";
import { csvResponse, toCsv } from "@/lib/csv";
import { villaClient } from "@/lib/villa-client";

/** Active asset register as CSV. Credentials are never exported. */
export async function GET() {
  const ctx = await getContext();
  if (!ctx.can("internal.view")) return new Response("Not found", { status: 404 });
  const t = await getTranslations();
  const assets = await ctx.db.asset.findMany({
    where: { archivedAt: null },
    include: {
      villa: { select: { name: true, client: { select: { name: true } }, manager: { select: { name: true } }, billTo: true } },
      area: { select: { name: true } },
      parent: { select: { name: true } },
      vendor: { select: { name: true } },
    },
    orderBy: [{ villa: { name: "asc" } }, { name: "asc" }],
  });
  const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
  const header = [
    t("common.name"), t("assets.code"), t("villas.client"), t("assets.villa"), t("assets.area"), t("assets.parent"), t("assets.system"),
    t("assets.category"), t("assets.manufacturer"), t("assets.model"), t("assets.serialNumber"), t("assets.macAddress"), t("assets.ipAddress"),
    t("assets.vlan"), t("assets.firmware"), t("common.status"), t("assets.criticality"), t("assets.installDate"), t("assets.warrantyExpiry"),
    t("assets.purchaseCost"), t("assets.vendor"),
  ];
  const rows = assets.map((a) => [
    a.name, a.code, villaClient(a.villa)?.name, a.villa.name, a.area?.name, a.parent?.name, t(`systems.${a.system}`),
    a.category, a.manufacturer, a.model, a.serialNumber, a.macAddress, a.ipAddress,
    a.vlan, a.firmware, t(`assetStatus.${a.status}`), t(`criticality.${a.criticality}`), day(a.installDate), day(a.warrantyExpiry),
    a.purchaseCost != null ? Number(a.purchaseCost) : null, a.vendor?.name,
  ]);
  return csvResponse(`assets_${new Date().toISOString().slice(0, 10)}.csv`, toCsv(header, rows));
}
