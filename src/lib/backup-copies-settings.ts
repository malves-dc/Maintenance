// Off-server copies of backups (Settings → Server): e-mail them to an address, and/or copy them to a cloud
// folder (OneDrive/SharePoint, Google Drive or WebDAV). Pure: shared by the settings page, actions, the
// copier and tests. Secrets (client secrets, refresh tokens, passwords) are stored encrypted.

export const COPY_KINDS = ["daily", "monthly", "manual", "pre-update", "hourly"] as const;
export type CopyKind = (typeof COPY_KINDS)[number];
export const CLOUD_PROVIDERS = ["off", "onedrive", "gdrive", "webdav"] as const;
export type CloudProvider = (typeof CLOUD_PROVIDERS)[number];

export type BackupCopies = {
  email: { enabled: boolean; to: string[]; kinds: CopyKind[]; encryptedOnly: boolean; maxMb: number };
  cloud: {
    provider: CloudProvider;
    kinds: CopyKind[];
    /** Folder path inside the drive / WebDAV root, e.g. "Backups/Maintenance". */
    folder: string;
    /** Upload only encrypted backups (an unencrypted one holds every record and the keys). */
    encryptedOnly: boolean;
    /** Delete from the cloud the backups the schedule removes here. */
    mirrorDeletes: boolean;
    onedrive: { tenant: string; clientId: string; clientSecretEnc: string | null; siteUrl: string; refreshTokenEnc: string | null; account: string | null };
    gdrive: { clientId: string; clientSecretEnc: string | null; refreshTokenEnc: string | null; account: string | null; folderId: string | null; folderPath: string | null };
    webdav: { url: string; user: string; passwordEnc: string | null };
  };
};

export const DEFAULT_KINDS: CopyKind[] = ["daily", "monthly", "manual", "pre-update"];
export const MAX_EMAIL_MB = 40;

export const DEFAULT_BACKUP_COPIES: BackupCopies = {
  email: { enabled: false, to: [], kinds: DEFAULT_KINDS, encryptedOnly: true, maxMb: 20 },
  cloud: {
    provider: "off",
    kinds: DEFAULT_KINDS,
    folder: "Maintenance backups",
    encryptedOnly: true,
    mirrorDeletes: true,
    onedrive: { tenant: "common", clientId: "", clientSecretEnc: null, siteUrl: "", refreshTokenEnc: null, account: null },
    gdrive: { clientId: "", clientSecretEnc: null, refreshTokenEnc: null, account: null, folderId: null, folderPath: null },
    webdav: { url: "", user: "", passwordEnc: null },
  },
};

const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const str = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const secret = (v: unknown) => (typeof v === "string" && v ? v : null);
const kinds = (v: unknown, fallback: CopyKind[]) => (Array.isArray(v) ? COPY_KINDS.filter((k) => v.includes(k)) : fallback);

/** "Backups//Maintenance/ " → "Backups/Maintenance" (no leading/trailing slashes, no "." or ".." parts). */
export function cleanFolder(path: string) {
  return path
    .split(/[\\/]+/)
    .map((p) => p.trim())
    .filter((p) => p && p !== "." && p !== "..")
    .join("/")
    .slice(0, 200);
}

export function normalizeBackupCopies(raw: unknown): BackupCopies {
  const o = obj(raw);
  const e = obj(o.email);
  const c = obj(o.cloud);
  const od = obj(c.onedrive);
  const gd = obj(c.gdrive);
  const wd = obj(c.webdav);
  const maxMb = Number(e.maxMb);
  const d = DEFAULT_BACKUP_COPIES;
  return {
    email: {
      enabled: e.enabled === true,
      to: Array.isArray(e.to) ? e.to.filter((x): x is string => typeof x === "string").slice(0, 5) : [],
      kinds: kinds(e.kinds, d.email.kinds),
      encryptedOnly: e.encryptedOnly !== false,
      maxMb: Number.isFinite(maxMb) && maxMb >= 1 && maxMb <= MAX_EMAIL_MB ? Math.round(maxMb) : d.email.maxMb,
    },
    cloud: {
      provider: (CLOUD_PROVIDERS as readonly unknown[]).includes(c.provider) ? (c.provider as CloudProvider) : "off",
      kinds: kinds(c.kinds, d.cloud.kinds),
      folder: cleanFolder(str(c.folder)) || d.cloud.folder,
      encryptedOnly: c.encryptedOnly !== false,
      mirrorDeletes: c.mirrorDeletes !== false,
      onedrive: {
        tenant: str(od.tenant, 100) || "common",
        clientId: str(od.clientId, 100),
        clientSecretEnc: secret(od.clientSecretEnc),
        siteUrl: str(od.siteUrl, 300),
        refreshTokenEnc: secret(od.refreshTokenEnc),
        account: str(od.account, 200) || null,
      },
      gdrive: {
        clientId: str(gd.clientId, 200),
        clientSecretEnc: secret(gd.clientSecretEnc),
        refreshTokenEnc: secret(gd.refreshTokenEnc),
        account: str(gd.account, 200) || null,
        folderId: str(gd.folderId, 200) || null,
        folderPath: str(gd.folderPath, 200) || null,
      },
      webdav: { url: str(wd.url, 500).replace(/\/+$/, ""), user: str(wd.user, 200), passwordEnc: secret(wd.passwordEnc) },
    },
  };
}

/** The backup kind a copy setting refers to (uploaded and pre-restore copies are never sent anywhere). */
export const isCopyKind = (k: string): k is CopyKind => (COPY_KINDS as readonly string[]).includes(k);

/** Whether the chosen cloud destination has what it needs to upload (OAuth ones must be connected). */
export function cloudReady(c: BackupCopies["cloud"]) {
  if (c.provider === "onedrive") return !!c.onedrive.clientId && !!c.onedrive.refreshTokenEnc;
  if (c.provider === "gdrive") return !!c.gdrive.clientId && !!c.gdrive.refreshTokenEnc;
  if (c.provider === "webdav") return /^https?:\/\/\S+$/i.test(c.webdav.url);
  return false;
}

/** Cloud decision for one backup: upload it, refuse it (not encrypted while only encrypted ones may leave), or skip this kind. */
export function cloudPlan(c: BackupCopies["cloud"], b: { kind: string; encrypted: boolean }): "upload" | "notEncrypted" | "skip" {
  if (!isCopyKind(b.kind) || !c.kinds.includes(b.kind)) return "skip";
  return c.encryptedOnly && !b.encrypted ? "notEncrypted" : "upload";
}

/** E-mail decision for one backup: send it, send only a notice (too big / not encrypted), or skip this kind. */
export function emailPlan(e: BackupCopies["email"], b: { kind: string; size: number; encrypted: boolean }): "attach" | "tooBig" | "notEncrypted" | "skip" {
  if (!e.enabled || !e.to.length || !isCopyKind(b.kind) || !e.kinds.includes(b.kind)) return "skip";
  if (e.encryptedOnly && !b.encrypted) return "notEncrypted";
  if (b.size > e.maxMb * 1024 * 1024) return "tooBig";
  return "attach";
}
