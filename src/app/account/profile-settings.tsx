import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Download } from "lucide-react";
import { ActionForm, FieldError } from "@/components/action-form";
import { Button, Card, Field, Input } from "@/components/ui";
import { twoFactorRequiredFor } from "@/lib/two-factor";
import { TwoFactorManage } from "@/app/(auth)/two-factor/forms";
import { PasswordInput } from "@/components/password-input";
import { requireUser } from "@/lib/context";
import { vapidPublicKey } from "@/lib/push";
import { privacyPath } from "@/lib/privacy";
import { NOTIFICATION_TYPES, PORTAL_TYPES, prefsOf, type Channels } from "@/lib/notification-types";
import { changePasswordAction, updateProfileAction } from "./actions";
import { NotificationPrefs, PushControl } from "./notification-settings";
import { appOrigin } from "@/lib/qr";
import { CalendarLink } from "./calendar-link";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { getTheme } from "@/lib/theme-server";

/** Profile, password and notification settings; `portal` limits the notification list to what clients get. */
export async function ProfileSettings({ portal = false, org }: { portal?: boolean; org: { slug: string } }) {
  const user = await requireUser();
  const t = await getTranslations();
  const format = await getFormatter();
  const twoFactorRequired = await twoFactorRequiredFor(user.id);
  const types = portal ? PORTAL_TYPES : NOTIFICATION_TYPES.filter((x) => x !== "REQUEST_UPDATE");
  const prefs = Object.fromEntries(types.map((type) => [type, prefsOf(user.notificationPrefs, type)])) as Record<string, Channels>;

  return (
    <div className="grid max-w-4xl gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        <Card className="p-5">
          <h2 className="mb-4 font-medium">{t("profile.appearance")}</h2>
          <div className="space-y-4">
            <div>
              <p className="mb-1.5 text-sm font-medium">{t("profile.language")}</p>
              <LocaleSwitcher />
            </div>
            <div>
              <p className="mb-1.5 text-sm font-medium">{t("theme.label")}</p>
              <ThemeToggle initial={await getTheme()} labels />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-medium">{t("profile.details")}</h2>
          <ActionForm action={updateProfileAction} successMessage={t("common.saved")}>
            <Field label={t("common.name")}>
              <Input name="name" defaultValue={user.name} required autoComplete="name" />
              <FieldError name="name" />
            </Field>
            <Field label={t("common.email")} hint={t("profile.emailHint")}>
              <Input value={user.email} readOnly disabled />
            </Field>
            <Field label={t("common.phone")}>
              <Input name="phone" type="tel" defaultValue={user.phone ?? ""} autoComplete="tel" />
            </Field>
          </ActionForm>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-medium">{t("profile.password")}</h2>
          <ActionForm action={changePasswordAction} submitLabel={t("profile.changePassword")} successMessage={t("profile.passwordChanged")}>
            {user.passwordHash && (
              <Field label={t("profile.currentPassword")}>
                <PasswordInput name="current" autoComplete="current-password" required />
                <FieldError name="current" />
              </Field>
            )}
            <Field label={t("auth.newPassword")} hint={t("auth.passwordRule")}>
              <PasswordInput name="password" autoComplete="new-password" minLength={8} required />
              <FieldError name="password" />
            </Field>
            <Field label={t("auth.confirmPassword")}>
              <PasswordInput name="confirm" autoComplete="new-password" minLength={8} required />
              <FieldError name="confirm" />
            </Field>
          </ActionForm>
        </Card>

        <Card className="p-5">
          <h2 className="mb-1 font-medium">{t("twoFactor.title")}</h2>
          {user.totpEnabledAt ? (
            <>
              <p className="mb-3 text-sm text-muted">
                {t("twoFactor.on", { date: format.dateTime(user.totpEnabledAt, { dateStyle: "medium" }) })} {twoFactorRequired && t("twoFactor.required")}
              </p>
              <TwoFactorManage canTurnOff={!twoFactorRequired} />
            </>
          ) : (
            <>
              <p className="mb-3 text-sm text-muted">{t("twoFactor.off")}</p>
              <Link href="/two-factor">
                <Button size="sm" variant="secondary">
                  {t("twoFactor.setUp")}
                </Button>
              </Link>
            </>
          )}
        </Card>
      </div>

      <div className="space-y-6">
        {!portal && (
          <Card className="p-5">
            <h2 className="mb-1 font-medium">{t("calendarFeed.title")}</h2>
            <p className="mb-3 text-sm text-muted">{t("calendarFeed.hint")}</p>
            <CalendarLink url={user.calendarToken ? `${await appOrigin()}/api/calendar/${user.calendarToken}.ics` : null} />
          </Card>
        )}
        <Card className="p-5">
          <h2 className="mb-1 font-medium">{t("profile.pushTitle")}</h2>
          <p className="mb-3 text-sm text-muted">{t("profile.pushHint")}</p>
          <PushControl vapidKey={vapidPublicKey()} />
        </Card>
        <Card className="p-5">
          <h2 className="mb-1 font-medium">{t("profile.notifications")}</h2>
          <p className="mb-3 text-sm text-muted">{t("profile.notificationsHint")}</p>
          <NotificationPrefs types={types} initial={prefs} />
        </Card>
        <Card className="p-5">
          <h2 className="mb-1 font-medium">{t("privacy.yourData")}</h2>
          <p className="mb-3 text-sm text-muted">{t("privacy.yourDataHint")}</p>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            {/* A download, not a page: a plain link so the browser saves the file. */}
            <a href="/api/account/export" className="inline-flex items-center gap-1.5 font-medium text-brand">
              <Download className="size-4" />
              {t("privacy.download")}
            </a>
            <Link href={privacyPath(org)} className="text-muted hover:text-brand">
              {t("privacy.title")}
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
