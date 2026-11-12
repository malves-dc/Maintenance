"use client";

import { useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Cloud, Copy, Link2Off, Mail, Upload } from "lucide-react";
import { FieldError, FieldErrorsProvider } from "@/components/action-form";
import { Button, Field, FormError, Input, Textarea } from "@/components/ui";
import { PasswordInput } from "@/components/password-input";
import { useActionForm } from "@/lib/use-action-form";
import { COPY_KINDS, type CloudProvider, type CopyKind } from "@/lib/backup-copies-settings";
import { disconnectCloudAction, saveBackupCopiesAction } from "./actions";

export type CopiesFormValues = {
  email: { enabled: boolean; to: string[]; kinds: CopyKind[]; encryptedOnly: boolean; maxMb: number };
  cloud: {
    provider: CloudProvider;
    kinds: CopyKind[];
    folder: string;
    encryptedOnly: boolean;
    mirrorDeletes: boolean;
    onedrive: { tenant: string; clientId: string; hasSecret: boolean; siteUrl: string; account: string | null; connected: boolean };
    gdrive: { clientId: string; hasSecret: boolean; account: string | null; connected: boolean };
    webdav: { url: string; user: string; hasPassword: boolean };
  };
};
type Last = { at: string; name: string; ok: boolean; detail: string } | null;

/** Settings → Server → Backup copies: e-mail each backup and/or copy it to a cloud folder. */
export function BackupCopiesForm({
  values,
  backupsEncrypted,
  redirectUri,
  last,
}: {
  values: CopiesFormValues;
  backupsEncrypted: boolean;
  redirectUri: string;
  last: { email: Last; cloud: Last };
}) {
  const t = useTranslations("backupCopies");
  const tr = useTranslations();
  const format = useFormatter();
  const [provider, setProvider] = useState<CloudProvider>(values.cloud.provider);
  const [emailOn, setEmailOn] = useState(values.email.enabled);
  const [encryptedOnly, setEncryptedOnly] = useState(values.email.encryptedOnly);
  const [cloudEncryptedOnly, setCloudEncryptedOnly] = useState(values.cloud.encryptedOnly);
  const [state, submit, pending] = useActionForm(saveBackupCopiesAction);
  const [disconnecting, startDisconnect] = useTransition();
  const error = state?.error && state.error !== "validation" ? `${tr.has(state.error) ? tr(state.error) : tr("common.somethingWrong")}${state.detail ? ` ${state.detail}` : ""}` : null;

  const kindBoxes = (name: string, selected: CopyKind[]) => (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {COPY_KINDS.map((k) => (
        <label key={k} className="flex items-center gap-2 text-sm">
          <input type="checkbox" name={name} value={k} defaultChecked={selected.includes(k)} className="size-4 accent-brand" />
          {tr(`server.kinds.${k}` as never)}
        </label>
      ))}
    </div>
  );
  const lastLine = (l: Last) =>
    l && (
      <p className={`text-xs ${l.ok ? "text-muted" : "text-danger"}`}>
        {t(l.ok ? "lastOk" : "lastFailed", { at: format.dateTime(new Date(l.at), { dateStyle: "short", timeStyle: "short" }), name: l.name })} {!l.ok && l.detail && <span className="break-all">({l.detail})</span>}
      </p>
    );
  const secretHint = (saved: boolean) => (saved ? tr("server.email.secretSaved") : tr("server.email.secretHint"));

  return (
    <FieldErrorsProvider errors={state?.fieldErrors}>
      <form method="post" onSubmit={submit} className="space-y-6">
        {/* ── E-mail */}
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <Mail className="size-4 text-muted" />
            {t("emailTitle")}
          </h3>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="emailEnabled" checked={emailOn} onChange={(e) => setEmailOn(e.target.checked)} className="size-4 accent-brand" />
            {t("emailEnabled")}
          </label>
          {emailOn && (
            <div className="space-y-3 rounded-md bg-gray-50 p-4">
              <Field label={t("emailTo")} hint={t("emailToHint")}>
                <Textarea name="emailTo" defaultValue={values.email.to.join("\n")} className="min-h-14" placeholder="backups@empresa.pt" />
                <FieldError name="emailTo" />
              </Field>
              <div>
                <div className="mb-1.5 text-sm font-medium">{t("whichBackups")}</div>
                {kindBoxes("emailKinds", values.email.kinds)}
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="emailEncryptedOnly" checked={encryptedOnly} onChange={(e) => setEncryptedOnly(e.target.checked)} className="mt-0.5 size-4 accent-brand" />
                <span>
                  {t("encryptedOnly")}
                  <span className="block text-xs text-muted">{t("encryptedOnlyHint")}</span>
                </span>
              </label>
              {!backupsEncrypted && (
                <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">{encryptedOnly ? t("notEncryptedWillSkip") : t("notEncryptedWarning")}</p>
              )}
              <Field label={t("maxMb")} hint={t("maxMbHint")}>
                <Input name="emailMaxMb" type="number" min={1} max={40} defaultValue={values.email.maxMb} className="w-24" />
                <FieldError name="emailMaxMb" />
              </Field>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" name="intent" value="testEmail" size="sm" variant="secondary" disabled={pending}>
                  <Mail className="size-4" />
                  {t("testEmail")}
                </Button>
                {state?.ok && state.tested && state.tested.includes("@") && <span className="text-xs text-green-700">{t("testEmailSent", { to: state.tested })}</span>}
              </div>
              {lastLine(last.email)}
            </div>
          )}
        </section>

        {/* ── Cloud */}
        <section className="space-y-3 border-t border-border pt-5">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <Cloud className="size-4 text-muted" />
            {t("cloudTitle")}
          </h3>
          <div className="grid gap-2 sm:grid-cols-4">
            {(["off", "onedrive", "gdrive", "webdav"] as const).map((p) => (
              <label key={p} className={`flex cursor-pointer items-center gap-2 rounded-md border p-2.5 text-sm ${provider === p ? "border-brand bg-brand/5" : "border-border"}`}>
                <input type="radio" name="provider" value={p} checked={provider === p} onChange={() => setProvider(p)} className="accent-brand" />
                {t(`providers.${p}`)}
              </label>
            ))}
          </div>

          {provider !== "off" && (
            <div className="space-y-4 rounded-md bg-gray-50 p-4">
              <Field label={t("folder")} hint={provider === "gdrive" ? t("folderHintGdrive") : t("folderHint")}>
                <Input name="folder" defaultValue={values.cloud.folder} maxLength={200} />
              </Field>
              <div>
                <div className="mb-1.5 text-sm font-medium">{t("whichBackups")}</div>
                {kindBoxes("cloudKinds", values.cloud.kinds)}
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="cloudEncryptedOnly" checked={cloudEncryptedOnly} onChange={(e) => setCloudEncryptedOnly(e.target.checked)} className="mt-0.5 size-4 accent-brand" />
                <span>
                  {t("cloudEncryptedOnly")}
                  <span className="block text-xs text-muted">{t("cloudEncryptedOnlyHint")}</span>
                </span>
              </label>
              {!backupsEncrypted && (
                <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">{cloudEncryptedOnly ? t("cloudNotEncryptedWillSkip") : t("cloudNotEncryptedWarning")}</p>
              )}
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="mirrorDeletes" defaultChecked={values.cloud.mirrorDeletes} className="mt-0.5 size-4 accent-brand" />
                <span>
                  {t("mirrorDeletes")}
                  <span className="block text-xs text-muted">{t("mirrorDeletesHint")}</span>
                </span>
              </label>

              {(provider === "onedrive" || provider === "gdrive") && (
                <div className="space-y-2 rounded-md border border-border bg-surface p-3 text-xs">
                  <p className="text-muted">{t(provider === "onedrive" ? "onedriveSetup" : "gdriveSetup")}</p>
                  <div className="flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate rounded bg-gray-100 px-2 py-1">{redirectUri}</code>
                    <button type="button" title={t("copy")} onClick={() => navigator.clipboard?.writeText(redirectUri)} className="rounded p-1.5 text-muted hover:bg-gray-100 hover:text-brand">
                      <Copy className="size-4" />
                    </button>
                  </div>
                </div>
              )}

              {provider === "onedrive" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("clientId")}>
                    <Input name="odClientId" defaultValue={values.cloud.onedrive.clientId} autoComplete="off" />
                  </Field>
                  <Field label={t("clientSecret")} hint={secretHint(values.cloud.onedrive.hasSecret)}>
                    <PasswordInput name="odClientSecret" autoComplete="new-password" placeholder={values.cloud.onedrive.hasSecret ? "••••••••" : ""} />
                  </Field>
                  <Field label={t("tenant")} hint={t("tenantHint")}>
                    <Input name="odTenant" defaultValue={values.cloud.onedrive.tenant} />
                  </Field>
                  <Field label={t("siteUrl")} hint={t("siteUrlHint")}>
                    <Input name="odSiteUrl" defaultValue={values.cloud.onedrive.siteUrl} placeholder="https://empresa.sharepoint.com/sites/TI" />
                    <FieldError name="odSiteUrl" />
                  </Field>
                </div>
              )}
              {provider === "gdrive" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("clientId")}>
                    <Input name="gdClientId" defaultValue={values.cloud.gdrive.clientId} autoComplete="off" />
                  </Field>
                  <Field label={t("clientSecret")} hint={secretHint(values.cloud.gdrive.hasSecret)}>
                    <PasswordInput name="gdClientSecret" autoComplete="new-password" placeholder={values.cloud.gdrive.hasSecret ? "••••••••" : ""} />
                  </Field>
                </div>
              )}
              {(provider === "onedrive" || provider === "gdrive") &&
                (() => {
                  const p = provider === "onedrive" ? values.cloud.onedrive : values.cloud.gdrive;
                  return (
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      {p.connected ? (
                        <>
                          <span className="text-green-700">{t("connectedAs", { account: p.account ?? "—" })}</span>
                          <Button type="button" size="sm" variant="ghost" disabled={disconnecting} onClick={() => startDisconnect(() => disconnectCloudAction(provider))}>
                            <Link2Off className="size-4" />
                            {t("disconnect")}
                          </Button>
                        </>
                      ) : (
                        <span className="text-muted">{p.clientId && p.hasSecret ? t("notConnected") : t("saveFirst")}</span>
                      )}
                      {p.clientId && p.hasSecret && (
                        // A plain link: the browser goes to Microsoft / Google and comes back to the callback.
                        <a href={`/api/server/cloud/connect?provider=${provider}`} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-brand px-3 text-xs font-medium text-brand-foreground">
                          <Cloud className="size-4" />
                          {p.connected ? t("reconnect") : t("connect")}
                        </a>
                      )}
                    </div>
                  );
                })()}
              {provider === "webdav" && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label={t("webdavUrl")} hint={t("webdavUrlHint")}>
                    <Input name="webdavUrl" defaultValue={values.cloud.webdav.url} placeholder="https://cloud.empresa.pt/remote.php/dav/files/utilizador" />
                    <FieldError name="webdavUrl" />
                  </Field>
                  <Field label={tr("server.email.smtpUser")}>
                    <Input name="webdavUser" defaultValue={values.cloud.webdav.user} autoComplete="off" />
                  </Field>
                  <Field label={tr("server.email.smtpPassword")} hint={secretHint(values.cloud.webdav.hasPassword)}>
                    <PasswordInput name="webdavPassword" autoComplete="new-password" placeholder={values.cloud.webdav.hasPassword ? "••••••••" : ""} />
                  </Field>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" name="intent" value="testCloud" size="sm" variant="secondary" disabled={pending}>
                  <Upload className="size-4" />
                  {t("testCloud")}
                </Button>
                {state?.ok && state.tested && !state.tested.includes("@") && <span className="text-xs text-green-700">{t("testCloudOk", { folder: state.tested })}</span>}
              </div>
              {lastLine(last.cloud)}
            </div>
          )}
          {/* Keep the hidden providers' saved values when switching. */}
          {provider !== "onedrive" && (
            <>
              <input type="hidden" name="odClientId" value={values.cloud.onedrive.clientId} />
              <input type="hidden" name="odTenant" value={values.cloud.onedrive.tenant} />
              <input type="hidden" name="odSiteUrl" value={values.cloud.onedrive.siteUrl} />
            </>
          )}
          {provider !== "gdrive" && <input type="hidden" name="gdClientId" value={values.cloud.gdrive.clientId} />}
          {provider !== "webdav" && (
            <>
              <input type="hidden" name="webdavUrl" value={values.cloud.webdav.url} />
              <input type="hidden" name="webdavUser" value={values.cloud.webdav.user} />
            </>
          )}
          {provider === "off" && (
            <>
              <input type="hidden" name="folder" value={values.cloud.folder} />
              {values.cloud.kinds.map((k) => (
                <input key={k} type="hidden" name="cloudKinds" value={k} />
              ))}
              {values.cloud.mirrorDeletes && <input type="hidden" name="mirrorDeletes" value="on" />}
              {values.cloud.encryptedOnly && <input type="hidden" name="cloudEncryptedOnly" value="on" />}
            </>
          )}
        </section>
        {!emailOn && (
          <>
            {values.email.to.length > 0 && <input type="hidden" name="emailTo" value={values.email.to.join("\n")} />}
            {values.email.kinds.map((k) => (
              <input key={k} type="hidden" name="emailKinds" value={k} />
            ))}
            {values.email.encryptedOnly && <input type="hidden" name="emailEncryptedOnly" value="on" />}
            <input type="hidden" name="emailMaxMb" value={values.email.maxMb} />
          </>
        )}

        <FormError message={error} />
        <div className="flex items-center gap-3">
          <Button disabled={pending}>{tr("common.save")}</Button>
          {state?.ok && !state.tested && <span className="text-sm text-green-700">{tr("common.saved")}</span>}
        </div>
      </form>
    </FieldErrorsProvider>
  );
}
