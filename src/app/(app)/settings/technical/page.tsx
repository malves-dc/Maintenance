import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card, Field, PageHeader, Select } from "@/components/ui";
import { ActionForm, FieldError } from "@/components/action-form";
import { getContext } from "@/lib/context";
import { titled } from "@/lib/metadata";
import { CHECK_INTERVALS } from "@/lib/connectivity-rules";
import { updateTechnicalAction } from "./actions";

export const generateMetadata = titled("nav.technical");

export default async function TechnicalSettingsPage() {
  const ctx = await getContext();
  if (!ctx.can("org.manage")) notFound();
  const t = await getTranslations();
  const monitored = { archivedAt: null, connectivityType: { not: null } } as const;
  const [total, online, offline] = await Promise.all([
    ctx.db.villa.count({ where: monitored }),
    ctx.db.villa.count({ where: { ...monitored, online: true } }),
    ctx.db.villa.count({ where: { ...monitored, online: false } }),
  ]);

  return (
    <>
      <PageHeader title={t("nav.technical")} description={t("technical.description")} />
      <div className="grid max-w-5xl gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="p-6">
          <ActionForm action={updateTechnicalAction} successMessage={t("common.saved")}>
            <h2 className="font-medium">{t("connectivity.title")}</h2>
            <Field label={t("technical.interval")} hint={t("technical.intervalHint")}>
              <Select name="connectivityIntervalSec" defaultValue={String(ctx.organization.connectivityIntervalSec)} className="sm:max-w-60">
                {CHECK_INTERVALS.map((s) => (
                  <option key={s} value={s}>
                    {t(`technical.every.${s}`)}
                  </option>
                ))}
                <option value="0">{t("technical.every.0")}</option>
              </Select>
              <FieldError name="connectivityIntervalSec" />
            </Field>
          </ActionForm>
        </Card>
        <Card className="space-y-2 p-5 text-sm">
          <h2 className="font-medium">{t("technical.monitored")}</h2>
          {total === 0 ? (
            <p className="text-muted">{t("technical.noneMonitored")}</p>
          ) : (
            <dl className="space-y-1">
              <div className="flex justify-between">
                <dt className="text-muted">{t("technical.villas")}</dt>
                <dd className="tabular-nums">{total}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-green-700">{t("connectivity.online")}</dt>
                <dd className="tabular-nums">{online}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-red-700">{t("connectivity.offline")}</dt>
                <dd className="tabular-nums">{offline}</dd>
              </div>
            </dl>
          )}
          <Link href="/villas" className="inline-block text-brand">
            {t("technical.seeVillas")}
          </Link>
        </Card>
      </div>
    </>
  );
}
