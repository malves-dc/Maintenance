import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { readFile, stat, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createTranslator } from "next-intl";
import { decryptField, encryptField } from "@/lib/crypto";
import { emailLayout, sendEmail } from "@/lib/email";
import { dataDir, getAppName, getServerSettings, updateServerSettings } from "@/lib/server-settings";
import { isEncrypted } from "@/lib/backup-crypto";
import { parseBackupName } from "@/lib/backup-schedule";
import { cloudReady, emailPlan, isCopyKind, type BackupCopies } from "@/lib/backup-copies-settings";
import type { CloudTarget } from "@/lib/cloud/target";
import { webdavTarget } from "@/lib/cloud/webdav";
import { onedriveTarget } from "@/lib/cloud/onedrive";
import { gdriveTarget } from "@/lib/cloud/gdrive";
import en from "../../messages/en.json";
import pt from "../../messages/pt.json";

// Off-server copies of backups, run after each backup (lib/backups.ts): e-mail it (when the kind is chosen,
// and — if required — only when encrypted; too big → a notice instead) and/or upload it to the cloud folder.
// Backups the schedule removes here are removed there too (optional). Results are kept for Settings → Server.

type Outcome = { at: string; name: string; ok: boolean; detail: string };
export type CopyStatus = { email?: Outcome; cloud?: Outcome };

const statusFile = () => path.join(dataDir(), "backup-copies-status.json");

export async function copyStatus(): Promise<CopyStatus> {
  return JSON.parse(await readFile(statusFile(), "utf8").catch(() => "{}")) as CopyStatus;
}

async function record(channel: keyof CopyStatus, outcome: Omit<Outcome, "at">) {
  const status = await copyStatus();
  status[channel] = { ...outcome, at: new Date().toISOString() };
  await mkdir(dataDir(), { recursive: true });
  await writeFile(statusFile(), JSON.stringify(status, null, 2));
}

const decrypt = (v: string | null) => (v ? decryptField(v) : null);

/** The cloud destination from the settings, or null when off / not connected. */
export function cloudTarget(c: BackupCopies["cloud"]): CloudTarget | null {
  if (!cloudReady(c)) return null;
  if (c.provider === "webdav") return webdavTarget({ url: c.webdav.url, user: c.webdav.user, password: decrypt(c.webdav.passwordEnc), folder: c.folder });
  if (c.provider === "onedrive") {
    return onedriveTarget({
      app: { tenant: c.onedrive.tenant, clientId: c.onedrive.clientId, clientSecret: decrypt(c.onedrive.clientSecretEnc) ?? "", siteUrl: c.onedrive.siteUrl },
      refreshToken: decrypt(c.onedrive.refreshTokenEnc)!,
      folder: c.folder,
      onRefresh: async (token) => {
        const s = (await getServerSettings()).backupCopies;
        await updateServerSettings({ backupCopies: { ...s, cloud: { ...s.cloud, onedrive: { ...s.cloud.onedrive, refreshTokenEnc: encryptField(token) } } } });
      },
    });
  }
  if (c.provider === "gdrive") {
    return gdriveTarget({
      app: { clientId: c.gdrive.clientId, clientSecret: decrypt(c.gdrive.clientSecretEnc) ?? "" },
      refreshToken: decrypt(c.gdrive.refreshTokenEnc)!,
      folder: c.folder,
      // The cached folder id only counts for the folder it was found for.
      folderId: c.gdrive.folderPath === c.folder ? c.gdrive.folderId : null,
      onFolder: async (id) => {
        const s = (await getServerSettings()).backupCopies;
        await updateServerSettings({ backupCopies: { ...s, cloud: { ...s.cloud, gdrive: { ...s.cloud.gdrive, folderId: id, folderPath: s.cloud.folder } } } });
      },
    });
  }
  return null;
}

/** Texts in the language of the server's first company (backups are server-wide). */
async function translator() {
  const { prisma } = await import("@/lib/db/client");
  const org = await prisma.organization.findFirst({ select: { defaultLocale: true }, orderBy: { createdAt: "asc" } });
  const locale = org?.defaultLocale === "pt" ? "pt" : "en";
  return createTranslator({ locale, messages: locale === "pt" ? pt : en, namespace: "backupCopies.mail" });
}

const mb = (bytes: number) => `${Math.round((bytes / 1024 / 1024) * 10) / 10} MB`;

async function emailCopy(e: BackupCopies["email"], file: string, name: string, kind: string, size: number, encrypted: boolean) {
  const plan = emailPlan(e, { kind, size, encrypted });
  if (plan === "skip") return;
  const t = await translator();
  const app = await getAppName();
  const vars = { app, name, size: mb(size), max: `${e.maxMb} MB` };
  const paragraphs =
    plan === "attach"
      ? [t(encrypted ? "attachedEncrypted" : "attachedPlain", vars)]
      : [t(plan === "tooBig" ? "tooBig" : "notEncrypted", vars)];
  const mail = emailLayout({ org: app, heading: t("subject", vars), paragraphs });
  const attachments = plan === "attach" ? [{ filename: name, content: await readFile(file) }] : undefined;
  try {
    for (const to of e.to) await sendEmail({ to, subject: t("subject", vars), ...mail, attachments });
    await record("email", { name, ok: plan === "attach", detail: plan === "attach" ? e.to.join(", ") : plan });
  } catch (err) {
    await record("email", { name, ok: false, detail: err instanceof Error ? err.message.slice(0, 300) : String(err) });
  }
}

async function cloudCopy(c: BackupCopies["cloud"], file: string, name: string, kind: string, size: number, removed: string[]) {
  const target = cloudTarget(c);
  if (!target) return;
  const upload = isCopyKind(kind) && c.kinds.includes(kind);
  // Only backups this app names (and of kinds sent there) are ever deleted remotely.
  const toRemove = c.mirrorDeletes ? removed.filter((n) => parseBackupName(n)) : [];
  if (!upload && !toRemove.length) return;
  try {
    if (upload) await target.upload(file, name, size);
    for (const n of toRemove) await target.remove(n);
    if (upload) await record("cloud", { name, ok: true, detail: c.folder });
  } catch (err) {
    await record("cloud", { name, ok: false, detail: err instanceof Error ? err.message.slice(0, 300) : String(err) });
  }
}

/** Sends the copies of one new backup; `removed` are backups the schedule just deleted here. Never throws. */
export async function copyBackup(file: string, kind: string, removed: string[] = []) {
  try {
    const settings = (await getServerSettings()).backupCopies;
    const name = path.basename(file);
    const size = (await stat(file)).size;
    const encrypted = await isEncrypted(file);
    await Promise.all([emailCopy(settings.email, file, name, kind, size, encrypted), cloudCopy(settings.cloud, file, name, kind, size, removed)]);
  } catch (err) {
    console.error("[backup-copies]", err);
  }
}

/** Removes a backup deleted by hand here from the cloud too (when mirroring deletes). */
export async function removeCloudCopy(name: string) {
  const c = (await getServerSettings()).backupCopies.cloud;
  const target = c.mirrorDeletes && parseBackupName(name) ? cloudTarget(c) : null;
  await target?.remove(name).catch((err) => console.error("[backup-copies] remote delete failed", err));
}

// ── OAuth sign-in state (CSRF protection for the connect → callback round trip)

const sign = (payload: string) => createHmac("sha256", `cloud-oauth:${process.env.AUTH_SECRET}`).update(payload).digest("base64url");

export function oauthState(userId: string, provider: string) {
  const payload = `${userId}.${provider}.${Date.now() + 15 * 60_000}`;
  return `${payload}.${sign(payload)}`;
}

export function checkOauthState(state: string, userId: string): string | null {
  const i = state.lastIndexOf(".");
  const payload = state.slice(0, i);
  const [uid, provider, exp] = payload.split(".");
  const a = Buffer.from(sign(payload));
  const b = Buffer.from(state.slice(i + 1));
  const valid = uid === userId && Number(exp) > Date.now() && a.length === b.length && timingSafeEqual(a, b);
  return valid ? provider : null;
}
