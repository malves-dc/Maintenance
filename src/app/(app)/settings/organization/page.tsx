import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Button, Card, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { ActionForm, FieldError } from "@/components/action-form";
import { getContext } from "@/lib/context";
import { brandColor, DEFAULT_BRAND, logoSrc } from "@/lib/branding";
import { TIMEZONES } from "@/lib/timezones";
import { TIME_ROUNDING_OPTIONS, timeRoundingOf } from "@/lib/billing-time";
import { privacyPath } from "@/lib/privacy";
import { parseRetention, RETENTION_KEYS, RETENTION_MAX } from "@/lib/retention-rules";
import { parseBusinessHours } from "@/lib/sla-clock";
import { parseOnCallHours } from "@/lib/on-call";
import { parseCompanyRecipients } from "@/lib/report-recipients";
import { erasureDue } from "@/lib/erasure";

// Roles that can be sent copies of service reports (custom roles are added from the company's list).
const REPORT_ROLES = ["ADMIN", "MANAGER", "TECHNICIAN", "ACCOUNTANT", "VIEWER"] as const;
const NL = "\n";

// Monday first, Sunday last (day numbers: 0 = Sunday).
const WEEK = [1, 2, 3, 4, 5, 6, 0];
import { updateOrgAction } from "../actions";
import { BrandColorField, LogoUploader } from "./form";
import { OnCallHoursFields } from "./on-call-hours";
import { titled } from "@/lib/metadata";
import { TimeInput } from "@/components/date-input";

export const generateMetadata = titled("nav.organization");

const CURRENCIES = ["EUR", "GBP", "USD", "AED", "BRL", "CHF"];

export default async function OrgSettingsPage() {
  const ctx = await getContext();
  if (!ctx.can("org.manage")) notFound();
  const t = await getTranslations();
  const o = ctx.organization;
  const retention = parseRetention(o.retention);
  const hours = parseBusinessHours(o.businessHours);
  const reports = parseCompanyRecipients(o.reportRecipients);
  const [staff, jobRoles, former] = await Promise.all([
    ctx.db.membership.findMany({ where: { active: true, role: { not: "REQUESTER" } }, select: { user: { select: { id: true, name: true, email: true } } }, orderBy: { user: { name: "asc" } } }),
    ctx.db.jobRole.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    erasureDue(ctx),
  ]);
  const roleOptions = [
    ...REPORT_ROLES.map((r) => ({ value: r as string, label: t(`roles.${r}`) })),
    ...jobRoles.map((j) => ({ value: `job:${j.id}`, label: j.name })),
  ];
  const format = await getFormatter();
  // 2026-10-04 is a Sunday: day d of the week is 4 + d October.
  const weekday = (d: number) => format.dateTime(new Date(Date.UTC(2026, 9, 4 + d, 12)), { weekday: "long", timeZone: "UTC" });

  return (
    <>
      <PageHeader title={t("settings.orgTitle")} description={t("settings.orgDescription")} />
      <div className="grid max-w-5xl gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="p-6">
          <ActionForm action={updateOrgAction} successMessage={t("common.saved")}>
            <h2 className="font-medium">{t("company.details")}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("company.name")} hint={t("company.nameHint")}>
                <Input name="name" defaultValue={o.name} required maxLength={100} />
                <FieldError name="name" />
              </Field>
              <Field label={t("company.legalName")} hint={t("company.legalNameHint")}>
                <Input name="legalName" defaultValue={o.legalName ?? ""} maxLength={200} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("company.taxId")}>
                <Input name="taxId" defaultValue={o.taxId ?? ""} maxLength={40} />
              </Field>
              <Field label={t("common.phone")}>
                <Input name="phone" type="tel" defaultValue={o.phone ?? ""} maxLength={50} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("common.email")}>
                <Input name="email" type="email" defaultValue={o.email ?? ""} maxLength={200} />
                <FieldError name="email" />
              </Field>
              <Field label={t("vendors.website")}>
                <Input name="website" type="url" placeholder="https://" defaultValue={o.website ?? ""} maxLength={300} />
                <FieldError name="website" />
              </Field>
            </div>
            <Field label={t("vendors.address")}>
              <Textarea name="address" defaultValue={o.address ?? ""} className="min-h-20" maxLength={500} />
            </Field>

            <h2 className="border-t border-border pt-5 font-medium">{t("company.branding")}</h2>
            <BrandColorField defaultValue={o.brandColor ?? ""} fallback={DEFAULT_BRAND} />

            <h2 className="border-t border-border pt-5 font-medium">{t("company.documents")}</h2>
            <Field label={t("company.reportFooter")} hint={t("company.reportFooterHint")}>
              <Textarea name="reportFooter" defaultValue={o.reportFooter ?? ""} className="min-h-16" maxLength={500} />
            </Field>

            <h2 className="border-t border-border pt-5 font-medium">{t("privacy.title")}</h2>
            <Field label={t("privacy.customNotice")} hint={t("privacy.customNoticeHint")}>
              <Textarea name="privacyNotice" defaultValue={o.privacyNotice ?? ""} className="min-h-40" maxLength={20000} />
            </Field>
            <p className="-mt-2 text-xs">
              <Link href={privacyPath(o)} target="_blank" className="font-medium text-brand">
                {t("privacy.view")}
              </Link>
            </p>
            <div>
              <h3 className="text-sm font-medium">{t("retention.title")}</h3>
              <p className="mb-3 text-xs text-muted">{t("retention.hint")}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                {RETENTION_KEYS.map((k) => (
                  <Field key={k} label={t(`retention.${k}`)}>
                    <Input name={k} type="number" min={0} max={RETENTION_MAX[k]} step={1} required defaultValue={retention[k]} className="w-28" />
                    <FieldError name={k} />
                  </Field>
                ))}
              </div>
              {(former.members > 0 || former.clients > 0) && (
                <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                  <p>{t("retention.formerDue")}</p>
                  <p className="mt-1 flex flex-wrap gap-x-4">
                    {former.members > 0 && (
                      <Link href="/settings/users" className="font-medium underline">
                        {t("retention.formerMembersDue", { n: former.members })}
                      </Link>
                    )}
                    {former.clients > 0 && (
                      <Link href="/clients?archived=1" className="font-medium underline">
                        {t("retention.formerClientsDue", { n: former.clients })}
                      </Link>
                    )}
                  </p>
                </div>
              )}
            </div>
            <div>
              <h3 className="text-sm font-medium">{t("twoFactor.title")}</h3>
              <label className="mt-2 flex items-start gap-2 text-sm">
                <input type="checkbox" name="require2fa" defaultChecked={o.require2fa} className="mt-0.5" />
                <span>
                  {t("twoFactor.orgSetting")}
                  <span className="block text-xs text-muted">{t("twoFactor.orgSettingHint")}</span>
                </span>
              </label>
            </div>

            <h2 className="border-t border-border pt-5 font-medium">{t("company.regional")}</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t("settings.timezone")}>
                <Select name="timezone" defaultValue={o.timezone}>
                  {(TIMEZONES.includes(o.timezone) ? TIMEZONES : [o.timezone, ...TIMEZONES]).map((tz) => (
                    <option key={tz}>{tz}</option>
                  ))}
                </Select>
              </Field>
              <Field label={t("settings.currency")}>
                <Select name="currency" defaultValue={o.currency}>
                  {(CURRENCIES.includes(o.currency) ? CURRENCIES : [o.currency, ...CURRENCIES]).map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </Field>
              <Field label={t("settings.defaultLanguage")}>
                <Select name="defaultLocale" defaultValue={o.defaultLocale}>
                  <option value="en">English</option>
                  <option value="pt">Português</option>
                </Select>
              </Field>
            </div>

            <h2 className="border-t border-border pt-5 font-medium">{t("timeBilling.title")}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("timeBilling.rounding")} hint={t("timeBilling.hint")}>
                <Select name="timeRounding" defaultValue={String(timeRoundingOf(o.timeRounding))}>
                  {TIME_ROUNDING_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {m === 0 ? t("timeBilling.none") : t("timeBilling.block", { minutes: m })}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">{t("urgent.title")}</p>
              <p className="mb-3 text-xs text-muted">{t("urgent.hint")}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("urgent.fee", { currency: o.currency })}>
                  <Input name="urgentFee" type="number" min={0} step="0.01" defaultValue={Number(o.urgentFee)} />
                  <FieldError name="urgentFee" />
                </Field>
                <Field label={t("urgent.percent")}>
                  <Input name="urgentPercent" type="number" min={0} max={500} step={1} defaultValue={o.urgentPercent} />
                  <FieldError name="urgentPercent" />
                </Field>
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">{t("travel.title")}</p>
              <p className="mb-3 text-xs text-muted">{t("travel.hint")}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("travel.fee", { currency: o.currency })}>
                  <Input name="travelFee" type="number" min={0} step="0.01" defaultValue={Number(o.travelFee)} />
                  <FieldError name="travelFee" />
                </Field>
                <Field label={t("travel.radius")}>
                  <Input name="travelRadiusKm" type="number" min={0} max={1000} step={1} defaultValue={o.travelRadiusKm} />
                  <FieldError name="travelRadiusKm" />
                </Field>
                <Field label={t("travel.kmRate", { currency: o.currency })} hint={t("travel.kmRateHint")}>
                  <Input name="travelKmRate" type="number" min={0} step="0.01" defaultValue={Number(o.travelKmRate)} />
                  <FieldError name="travelKmRate" />
                </Field>
                <Field label={t("travel.countBy")}>
                  <Select name="travelPerTechnician" defaultValue={o.travelPerTechnician ? "technician" : "workOrder"}>
                    <option value="technician">{t("travel.perTechnician")}</option>
                    <option value="workOrder">{t("travel.perWorkOrder")}</option>
                  </Select>
                </Field>
              </div>
            </div>

            <h2 className="border-t border-border pt-5 font-medium">{t("reportEmail.companyTitle")}</h2>
            <p className="-mt-2 text-xs text-muted">{t("reportEmail.companyHint")}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <fieldset>
                <legend className="mb-1.5 text-sm font-medium">{t("reportEmail.companyRoles")}</legend>
                <div className="space-y-1">
                  {roleOptions.map((r) => (
                    <label key={r.value} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="reportRoles" value={r.value} defaultChecked={reports.roles.includes(r.value)} className="size-4 accent-brand" />
                      {r.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="mb-1.5 text-sm font-medium">{t("reportEmail.companyPeople")}</legend>
                <div className="max-h-48 space-y-1 overflow-y-auto">
                  {staff.map(({ user: u }) => (
                    <label key={u.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="reportUserIds" value={u.id} defaultChecked={reports.userIds.includes(u.id)} className="size-4 accent-brand" />
                      <span className="truncate">{u.name}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
            <Field label={t("reportEmail.companyEmails")} hint={t("reportEmail.onePerLine")}>
              <Textarea name="reportCompanyEmails" defaultValue={reports.emails.join(NL)} className="min-h-16" placeholder="contabilidade@exemplo.pt" />
              <FieldError name="reportCompanyEmails" />
            </Field>

            <h2 className="border-t border-border pt-5 font-medium">{t("businessHours.title")}</h2>
            <p className="-mt-2 text-xs text-muted">{t("businessHours.hint")}</p>
            <div className="space-y-2">
              {WEEK.map((d) => {
                const h = hours.days[d];
                return (
                  <div key={d} className="flex flex-wrap items-center gap-3 text-sm">
                    <label className="flex w-36 items-center gap-2">
                      <input type="checkbox" name={`open${d}`} defaultChecked={!!h} className="size-4 accent-brand" />
                      {weekday(d)}
                    </label>
                    <TimeInput name={`start${d}`} defaultValue={h?.start ?? "09:00"} className="w-24" aria-label={`${weekday(d)} ${t("businessHours.from")}`} />
                    <span className="text-muted">–</span>
                    <TimeInput name={`end${d}`} defaultValue={h?.end ?? "18:00"} className="w-24" aria-label={`${weekday(d)} ${t("businessHours.to")}`} />
                    <FieldError name={`end${d}`} />
                  </div>
                );
              })}
            </div>
            <Field label={t("businessHours.holidays")} hint={t("businessHours.holidaysHint")}>
              <Textarea name="holidays" defaultValue={hours.holidays.join("\n")} className="min-h-24 font-mono" placeholder="2026-12-25" />
              <FieldError name="holidays" />
            </Field>

            <h2 className="border-t border-border pt-5 font-medium">{t("onCallHours.title")}</h2>
            <p className="-mt-2 text-xs text-muted">{t("onCallHours.hint")}</p>
            <OnCallHoursFields hours={parseOnCallHours(o.onCallHours)} weekdays={[0, 1, 2, 3, 4, 5, 6].map(weekday)} />
          </ActionForm>
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-1 font-medium">{t("company.logo")}</h2>
            <p className="mb-3 text-xs text-muted">{t("company.logoHint")}</p>
            <LogoUploader src={logoSrc(o)} name={o.name} color={brandColor(o)} />
          </Card>
          {ctx.can("requests.approve") && (
            <Card className="p-5">
              <h2 className="mb-1 font-medium">{t("gdprExport.requesterTitle")}</h2>
              <p className="mb-3 text-xs text-muted">{t("gdprExport.requesterHint")}</p>
              {/* A native POST: the route answers with a file download, and the address stays out of the URL. */}
              <form method="post" action="/api/export/requester" className="flex gap-2">
                <Input name="email" type="email" required maxLength={200} placeholder={t("common.email")} aria-label={t("common.email")} />
                <Button type="submit" variant="secondary">
                  {t("gdprExport.download")}
                </Button>
              </form>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
