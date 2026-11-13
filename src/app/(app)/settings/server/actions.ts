"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { expiredSessionCookie, isSessionCookie } from "@/lib/session-cookie";
import { z } from "zod";
import { requirePermission } from "@/lib/context";
import { optStr, parseForm, type FormResult } from "@/lib/forms";
import { lockServerAdmin, requireServerAdmin, unlockServerAdmin } from "@/lib/server-admin";
import { getAppName, getServerSettings, updateServerSettings } from "@/lib/server-settings";
import { signupLockedByEnv } from "@/lib/signup";
import { normalizeSchedule, validTimezone } from "@/lib/backup-schedule";
import { BackupError, createBackup, deleteBackup, restartSoon, restoreBackup, updateNow } from "@/lib/backups";
import { checkForUpdate, updaterConfigured } from "@/lib/updates";
import { getTranslations } from "next-intl/server";
import { encryptField } from "@/lib/crypto";
import { emailLayout, sendEmail, sendTestEmail } from "@/lib/email";
import { EMAIL_PROVIDERS, SMTP_SECURITY, validFrom, type EmailProvider, type EmailSettings, type SmtpSecurity } from "@/lib/email-settings";
import { isEmail, parseEmailList } from "@/lib/report-recipients";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { cloudTarget, removeCloudCopy } from "@/lib/backup-copies";
import { audit, changesOf, requestIp, writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/db/client";
import { listOnlineUsers } from "@/lib/online-users";

/** Server operations are logged in the company of the admin who did them. */
const serverAudit = (ctx: { organization: { id: string }; user: { id: string } }, action: string, meta?: Record<string, unknown>) =>
  audit(ctx, `server.${action}`, "Server", "-", meta as never);
import { CLOUD_PROVIDERS, cleanFolder, COPY_KINDS, MAX_EMAIL_MB, type BackupCopies, type CloudProvider } from "@/lib/backup-copies-settings";

const PAGE = "/settings/server";

/** Maps failures to message keys under "server.errors". */
function failure(e: unknown): NonNullable<FormResult> {
  const code = e instanceof BackupError ? e.code : e instanceof Error && /^(updaterNotConfigured|updateInProgress|updaterError)$/.test(e.message) ? e.message : "failed";
  if (code === "failed") console.error("[server-admin]", e);
  return { error: `server.errors.${code}` };
}

export async function unlockAction(_: FormResult, form: FormData): Promise<FormResult> {
  const ctx = await requirePermission("org.manage");
  const result = await unlockServerAdmin(ctx.user.id, String(form.get("password") ?? ""));
  if (result !== "disabled") await serverAudit(ctx, result === "ok" ? "unlock" : result === "blocked" ? "unlockBlocked" : "unlockFailed");
  if (result === "blocked") return { error: "server.errors.tooManyAttempts" };
  if (result !== "ok") return { error: "server.errors.wrongPassword" };
  revalidatePath(PAGE);
  return { ok: true };
}

/** Refresh button of "Who is online" (this company only, no server password): the list without reloading the page. */
export async function onlineUsersAction() {
  const ctx = await requirePermission("org.manage");
  return listOnlineUsers(ctx.db);
}

export async function lockAction() {
  await requirePermission("org.manage");
  await lockServerAdmin();
  revalidatePath(PAGE);
}

export async function saveGeneralAction(_: FormResult, form: FormData): Promise<FormResult> {
  const ctx = await requireServerAdmin();
  const parsed = parseForm(z.object({ appName: optStr(40) }), form);
  if (parsed.error) return parsed.error;
  const before = await getServerSettings();
  const next = {
    appName: parsed.data.appName,
    showVersion: form.get("showVersion") === "on",
    // ALLOW_SIGNUP=false disables the checkbox (so it isn't sent): keep the stored choice.
    allowSignup: signupLockedByEnv() ? before.allowSignup : form.get("allowSignup") === "on",
  };
  await updateServerSettings(next);
  const { changes } = changesOf({ appName: before.appName, showVersion: before.showVersion, allowSignup: before.allowSignup }, next);
  if (Object.keys(changes).length) await serverAudit(ctx, "settings", { changes });
  revalidatePath("/", "layout");
  return { ok: true };
}

const scheduleSchema = z.object({
  hour: z.coerce.number().int().min(0).max(23),
  timezone: z.string().refine(validTimezone, "invalid"),
  hourlyKeep: z.coerce.number().int().min(1).max(500),
  dailyKeep: z.coerce.number().int().min(1).max(500),
  monthlyKeep: z.coerce.number().int().min(1).max(500),
});

export async function saveScheduleAction(_: FormResult, form: FormData): Promise<FormResult> {
  const ctx = await requireServerAdmin();
  const parsed = parseForm(scheduleSchema, form);
  if (parsed.error) return parsed.error;
  const d = parsed.data;
  const on = (k: string) => form.get(k) === "on";
  const before = await getServerSettings();
  const next = {
    backups: normalizeSchedule({
      hourly: { enabled: on("hourly"), keep: d.hourlyKeep },
      daily: { enabled: on("daily"), keep: d.dailyKeep },
      monthly: { enabled: on("monthly"), keep: d.monthlyKeep },
      hour: d.hour,
      timezone: d.timezone,
    }),
    autoUpdate: on("autoUpdate") && updaterConfigured(),
  };
  await updateServerSettings(next);
  const { changes } = changesOf({ backups: before.backups, autoUpdate: before.autoUpdate }, next);
  if (Object.keys(changes).length) await serverAudit(ctx, "backupSchedule", { changes });
  revalidatePath(PAGE);
  return { ok: true };
}

export async function backupNowAction(): Promise<FormResult> {
  const ctx = await requireServerAdmin();
  try {
    const name = await createBackup("manual");
    await serverAudit(ctx, "backup", { name });
  } catch (e) {
    return failure(e);
  }
  revalidatePath(PAGE);
  return { ok: true };
}

export async function deleteBackupAction(name: string) {
  const ctx = await requireServerAdmin();
  await deleteBackup(name).catch(() => undefined);
  await serverAudit(ctx, "backupDelete", { name });
  void removeCloudCopy(name); // when mirroring deletes to the cloud folder
  revalidatePath(PAGE);
}

export type RestoreResult = (NonNullable<FormResult> & { restarting?: boolean; overridden?: string[] }) | undefined;

export async function restoreBackupAction(name: string): Promise<RestoreResult> {
  const ctx = await requireServerAdmin();
  try {
    await serverAudit(ctx, "restore", { name }); // kept in the safety backup taken before the restore
    const { overridden } = await restoreBackup(name);
    console.warn(`[server-admin] restore of ${name} by ${ctx.user.email}`);
    await auditRestored(name, ctx.user);
    // The data was replaced: this session's account may not exist in the backup. Sign in again afterwards.
    const jar = await cookies();
    for (const { name: cookie } of jar.getAll()) {
      if (isSessionCookie(cookie)) jar.set(cookie, "", expiredSessionCookie(cookie));
    }
    return { ok: true, restarting: restartSoon(), overridden };
  } catch (e) {
    return failure(e);
  }
}

export async function checkUpdatesAction() {
  await requireServerAdmin();
  await checkForUpdate(true);
  revalidatePath(PAGE);
}

export async function updateNowAction(): Promise<FormResult> {
  const ctx = await requireServerAdmin();
  const status = await checkForUpdate(true);
  if (!status.available) return { error: "server.errors.noUpdate" };
  try {
    await updateNow();
  } catch (e) {
    return failure(e);
  }
  console.warn(`[server-admin] update to ${status.latest?.version} requested by ${ctx.user.email}`);
  await serverAudit(ctx, "update", { from: status.current, to: status.latest?.version ?? null });
  return { ok: true };
}


// ── E-mail delivery

export type EmailResult = { ok?: boolean; error?: string; fieldErrors?: Record<string, string>; detail?: string; tested?: string } | undefined;

/**
 * Reads the e-mail form. Secret fields left blank keep the stored value, so the password/API key never has
 * to be sent back to the browser. Returns field errors (message keys) when the chosen provider is incomplete.
 */
function emailFromForm(form: FormData, current: EmailSettings): { settings: EmailSettings } | { fieldErrors: Record<string, string> } {
  const get = (k: string) => String(form.get(k) ?? "").trim();
  const provider = (EMAIL_PROVIDERS as readonly string[]).includes(get("provider")) ? (get("provider") as EmailProvider) : "env";
  const port = Number(get("smtpPort") || 587);
  const password = get("smtpPassword");
  const apiKey = get("resendKey");
  const settings: EmailSettings = {
    provider,
    from: get("from").slice(0, 300),
    smtp: {
      host: get("smtpHost").slice(0, 255),
      port: Number.isInteger(port) && port > 0 && port < 65536 ? port : 587,
      security: (SMTP_SECURITY as readonly string[]).includes(get("smtpSecurity")) ? (get("smtpSecurity") as SmtpSecurity) : "starttls",
      user: get("smtpUser").slice(0, 300),
      passwordEnc: form.get("smtpPasswordClear") === "on" ? null : password ? encryptField(password) : current.smtp.passwordEnc,
    },
    resend: { apiKeyEnc: apiKey ? encryptField(apiKey) : current.resend.apiKeyEnc },
  };
  const errors: Record<string, string> = {};
  if (provider !== "env" && !validFrom(settings.from)) errors.from = "badFrom";
  if (provider === "smtp" && !settings.smtp.host) errors.smtpHost = "too_small";
  if (provider === "smtp" && !(Number.isInteger(port) && port > 0 && port < 65536)) errors.smtpPort = "invalid";
  if (provider === "resend" && !settings.resend.apiKeyEnc) errors.resendKey = "too_small";
  return Object.keys(errors).length ? { fieldErrors: errors } : { settings };
}

/** Saves the e-mail settings, or (button "Send test e-mail") sends a test with what is in the form. */
export async function saveEmailAction(_: EmailResult, form: FormData): Promise<EmailResult> {
  const ctx = await requireServerAdmin();
  const current = (await getServerSettings()).email;
  const read = emailFromForm(form, current);
  if ("fieldErrors" in read) return { error: "validation", fieldErrors: read.fieldErrors };

  if (form.get("intent") === "test") {
    const to = String(form.get("testTo") ?? "").trim() || ctx.user.email;
    if (!isEmail(to)) return { error: "validation", fieldErrors: { testTo: "invalid_format" } };
    if (read.settings.provider === "env") return { error: "server.email.testNeedsProvider" };
    const t = await getTranslations("server.email");
    try {
      await sendTestEmail(read.settings, to, {
        subject: t("testSubject", { app: await getAppName() }),
        ...emailLayout({ org: await getAppName(), heading: t("testSubject", { app: await getAppName() }), paragraphs: [t("testBody")] }),
      });
    } catch (e) {
      // Shown to the server admin only: the provider's own message is what helps fix the settings.
      return { error: "server.email.testFailed", detail: e instanceof Error ? e.message.slice(0, 300) : String(e) };
    }
    return { ok: true, tested: to };
  }

  await updateServerSettings({ email: read.settings });
  const emailChanges = changesOf(emailSummary(current), emailSummary(read.settings)).changes;
  if (Object.keys(emailChanges).length) await serverAudit(ctx, "email", { changes: emailChanges });
  revalidatePath(PAGE);
  return { ok: true };
}

/** E-mail settings as flat fields for the audit log (secret fields are masked by their name). */
const emailSummary = (e: EmailSettings) => ({
  provider: e.provider,
  from: e.from,
  smtpHost: e.smtp.host,
  smtpPort: e.smtp.port,
  smtpSecurity: e.smtp.security,
  smtpUser: e.smtp.user,
  smtpPasswordEnc: e.smtp.passwordEnc,
  resendKeyEnc: e.resend.apiKeyEnc,
});

// ── Backup copies (e-mail / cloud)

export type CopiesResult = { ok?: boolean; error?: string; fieldErrors?: Record<string, string>; detail?: string; tested?: string } | undefined;

/** Reads the form; secret fields left blank keep their stored value. */
function copiesFromForm(form: FormData, current: BackupCopies): { copies: BackupCopies } | { fieldErrors: Record<string, string> } {
  const get = (k: string) => String(form.get(k) ?? "").trim();
  const errors: Record<string, string> = {};
  const to = parseEmailList(get("emailTo"));
  if (to.invalid.length) errors.emailTo = "badEmails";
  const emailEnabled = form.get("emailEnabled") === "on";
  if (emailEnabled && !to.emails.length) errors.emailTo = "too_small";
  const maxMb = Number(get("emailMaxMb") || 20);
  if (!(maxMb >= 1 && maxMb <= MAX_EMAIL_MB)) errors.emailMaxMb = "invalid";
  const provider = (CLOUD_PROVIDERS as readonly string[]).includes(get("provider")) ? (get("provider") as CloudProvider) : "off";
  const webdavUrl = get("webdavUrl").replace(/\/+$/, "");
  if (provider === "webdav" && !/^https?:\/\/\S+$/i.test(webdavUrl)) errors.webdavUrl = "invalid_url";
  const keep = (field: string, stored: string | null) => (get(field) ? encryptField(get(field)) : stored);
  const kinds = (field: string) => COPY_KINDS.filter((k) => form.getAll(field).includes(k));
  const c = current.cloud;
  const odClientId = get("odClientId");
  const gdClientId = get("gdClientId");
  const copies: BackupCopies = {
    email: { enabled: emailEnabled, to: to.emails.slice(0, 5), kinds: kinds("emailKinds"), encryptedOnly: form.get("emailEncryptedOnly") === "on", maxMb: Math.round(maxMb) },
    cloud: {
      provider,
      kinds: kinds("cloudKinds"),
      folder: cleanFolder(get("folder")) || c.folder,
      encryptedOnly: form.get("cloudEncryptedOnly") === "on",
      mirrorDeletes: form.get("mirrorDeletes") === "on",
      onedrive: {
        tenant: get("odTenant") || "common",
        clientId: odClientId,
        clientSecretEnc: keep("odClientSecret", c.onedrive.clientSecretEnc),
        siteUrl: get("odSiteUrl"),
        // A different app registration invalidates the stored sign-in.
        refreshTokenEnc: odClientId === c.onedrive.clientId ? c.onedrive.refreshTokenEnc : null,
        account: odClientId === c.onedrive.clientId ? c.onedrive.account : null,
      },
      gdrive: {
        clientId: gdClientId,
        clientSecretEnc: keep("gdClientSecret", c.gdrive.clientSecretEnc),
        refreshTokenEnc: gdClientId === c.gdrive.clientId ? c.gdrive.refreshTokenEnc : null,
        account: gdClientId === c.gdrive.clientId ? c.gdrive.account : null,
        folderId: c.gdrive.folderId,
        folderPath: c.gdrive.folderPath,
      },
      webdav: { url: webdavUrl, user: get("webdavUser"), passwordEnc: keep("webdavPassword", c.webdav.passwordEnc) },
    },
  };
  if (form.get("odSiteUrl") && get("odSiteUrl") && !/^https:\/\/[^/\s]+\.sharepoint\.com\/\S*$/i.test(get("odSiteUrl"))) errors.odSiteUrl = "invalid_url";
  return Object.keys(errors).length ? { fieldErrors: errors } : { copies };
}

/** Saves the copy settings; with intent=testEmail / testCloud it checks that channel with what is in the form. */
export async function saveBackupCopiesAction(_: CopiesResult, form: FormData): Promise<CopiesResult> {
  const ctx = await requireServerAdmin();
  const current = (await getServerSettings()).backupCopies;
  const read = copiesFromForm(form, current);
  if ("fieldErrors" in read) return { error: "validation", fieldErrors: read.fieldErrors };
  const intent = form.get("intent");

  if (intent === "testEmail") {
    if (!read.copies.email.to.length) return { error: "validation", fieldErrors: { emailTo: "too_small" } };
    const app = await getAppName();
    const t = await getTranslations("backupCopies.mail");
    try {
      for (const to of read.copies.email.to) await sendEmail({ to, subject: t("testSubject", { app }), ...emailLayout({ org: app, heading: t("testSubject", { app }), paragraphs: [t("testBody")] }) });
    } catch (e) {
      return { error: "backupCopies.testFailed", detail: e instanceof Error ? e.message.slice(0, 300) : String(e) };
    }
    return { ok: true, tested: read.copies.email.to.join(", ") };
  }

  if (intent === "testCloud") {
    const target = cloudTarget(read.copies.cloud);
    if (!target) return { error: "backupCopies.cloudNotReady" };
    const dir = await mkdtemp(path.join(tmpdir(), "copy-test-"));
    const file = path.join(dir, "connection-test.txt");
    try {
      await writeFile(file, `Connection test from ${await getAppName()} at ${new Date().toISOString()}\n`);
      const size = (await stat(file)).size;
      await target.upload(file, "connection-test.txt", size);
      const listed = await target.list();
      await target.remove("connection-test.txt");
      if (!listed.includes("connection-test.txt")) return { error: "backupCopies.testFailed", detail: "uploaded, but not found in the folder listing" };
    } catch (e) {
      return { error: "backupCopies.testFailed", detail: e instanceof Error ? e.message.slice(0, 300) : String(e) };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
    return { ok: true, tested: read.copies.cloud.folder };
  }

  await updateServerSettings({ backupCopies: read.copies });
  const copyChanges = changesOf(copiesSummary(current), copiesSummary(read.copies)).changes;
  if (Object.keys(copyChanges).length) await serverAudit(ctx, "backupCopies", { changes: copyChanges });
  revalidatePath(PAGE);
  return { ok: true };
}

/** The copy settings as flat fields for the audit log (secret fields are masked by their name). */
const copiesSummary = (c: BackupCopies) => ({
  emailEnabled: c.email.enabled,
  emailTo: c.email.to.join(", "),
  emailKinds: c.email.kinds.join(", "),
  emailEncryptedOnly: c.email.encryptedOnly,
  emailMaxMb: c.email.maxMb,
  cloudProvider: c.cloud.provider,
  cloudKinds: c.cloud.kinds.join(", "),
  cloudFolder: c.cloud.folder,
  cloudEncryptedOnly: c.cloud.encryptedOnly,
  mirrorDeletes: c.cloud.mirrorDeletes,
  onedriveTenant: c.cloud.onedrive.tenant,
  onedriveClientId: c.cloud.onedrive.clientId,
  onedriveClientSecretEnc: c.cloud.onedrive.clientSecretEnc,
  onedriveSiteUrl: c.cloud.onedrive.siteUrl,
  gdriveClientId: c.cloud.gdrive.clientId,
  gdriveClientSecretEnc: c.cloud.gdrive.clientSecretEnc,
  webdavUrl: c.cloud.webdav.url,
  webdavUser: c.cloud.webdav.user,
  webdavPasswordEnc: c.cloud.webdav.passwordEnc,
});

/**
 * The restore replaced the database, audit log included: the entry is written into the restored companies so
 * it is not lost (as the admin when their account exists in the backup, else without a user).
 */
async function auditRestored(name: string, admin: { id: string; email: string }) {
  const ip = await requestIp();
  const known = await prisma.user.findUnique({ where: { id: admin.id }, select: { id: true } }).catch(() => null);
  for (const o of await prisma.organization.findMany({ select: { id: true } }).catch(() => [])) {
    await writeAudit({ organizationId: o.id, userId: known?.id ?? null, action: "server.restored", entityType: "Server", entityId: "-", meta: { name, by: admin.email }, ip });
  }
}

/** Forgets the stored OneDrive / Google sign-in. */
export async function disconnectCloudAction(provider: "onedrive" | "gdrive") {
  const ctx = await requireServerAdmin();
  await serverAudit(ctx, "cloudDisconnect", { provider });
  const s = (await getServerSettings()).backupCopies;
  const cloud =
    provider === "onedrive"
      ? { ...s.cloud, onedrive: { ...s.cloud.onedrive, refreshTokenEnc: null, account: null } }
      : { ...s.cloud, gdrive: { ...s.cloud.gdrive, refreshTokenEnc: null, account: null, folderId: null, folderPath: null } };
  await updateServerSettings({ backupCopies: { ...s, cloud } });
  revalidatePath(PAGE);
}
