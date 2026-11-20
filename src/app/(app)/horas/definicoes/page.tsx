import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ActionForm, FieldError } from "@/components/action-form";
import { Card, Field, Input } from "@/components/ui";
import { getContext } from "@/lib/context";
import { hoursHosts } from "@/lib/hours-host";
import { titled } from "@/lib/metadata";
import { saveHoursSettingsAction } from "../actions";
import { ImportPanel } from "./import-panel";

export const generateMetadata = titled("hours.tabs.settings");

export default async function HoursSettingsPage() {
  const ctx = await getContext();
  if (!ctx.can("org.manage")) notFound();
  const t = await getTranslations("hours");
  const hosts = hoursHosts();
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Card className="p-4">
        <ActionForm action={saveHoursSettingsAction} successMessage={t("saved")}>
          <Field label={t("editDays")} hint={t("editDaysHint")}>
            <Input name="editDays" type="number" min={0} max={365} defaultValue={ctx.organization.timesheetEditDays} required />
            <FieldError name="editDays" />
          </Field>
          <Field label={t("dailyHours")} hint={t("dailyHoursHint")}>
            <Input name="dailyHours" inputMode="decimal" defaultValue={String(Number(ctx.organization.timesheetDailyHours))} required />
            <FieldError name="dailyHours" />
          </Field>
        </ActionForm>
      </Card>
      <Card className="space-y-1 p-4 text-sm">
        <div className="font-medium">{t("ownAddress")}</div>
        <p className="text-muted">{hosts.length ? t("ownAddressOn", { hosts: hosts.join(", ") }) : t("ownAddressOff")}</p>
      </Card>
      <Card className="space-y-1 p-4 text-sm">
        <div className="font-medium">{t("whoLogs")}</div>
        <p className="text-muted">{t("whoLogsHint")}</p>
      </Card>
      <Card className="space-y-2 p-4">
        <div className="text-sm font-medium">{t("import.title")}</div>
        <ImportPanel />
      </Card>
    </div>
  );
}
