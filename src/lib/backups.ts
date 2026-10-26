import "server-only";
import { spawn, spawnSync } from "node:child_process";
import { chmod, cp, mkdir, mkdtemp, readdir, readFile, rename, rm, stat, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db/client";
import { clearAllObjects, uploadRoot } from "@/lib/storage";
import { dataDir, getServerSettings } from "@/lib/server-settings";
import { APP_VERSION } from "@/lib/version";
import { backupPassword, BackupCryptoError, decryptFile, encryptFile, isEncrypted } from "@/lib/backup-crypto";
import { checkForUpdate, triggerUpdate, updaterConfigured } from "@/lib/updates";
import {
  backupFileName,
  backupsToPrune,
  dueKinds,
  localHour,
  parseBackupName,
  slotOf,
  type BackupKind,
  type ScheduleState,
} from "@/lib/backup-schedule";

// Full backups: one .tar.gz with manifest.json, database.dump (pg_dump custom format), secrets.env
// (the keys encrypted fields and sessions depend on) and uploads/. Needs pg_dump, pg_restore, psql
// and tar, which the Docker image ships; elsewhere the feature reports itself unavailable.

export const backupDir = () => path.resolve(process.env.BACKUP_DIR ?? "./backups");
const SECRET_KEYS = ["AUTH_SECRET", "FIELD_ENCRYPTION_KEY", "CRON_SECRET", "VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"] as const;
const FORMAT = 1;

export class BackupError extends Error {
  constructor(
    public code: "unavailable" | "busy" | "notFound" | "invalidBackup" | "backupNewer" | "failed" | "encryptedNoPassword" | "wrongBackupPassword",
    detail?: string,
  ) {
    super(detail ? `${code}: ${detail}` : code);
  }
}

let tools: boolean | null = null;
export function backupsAvailable() {
  tools ??= ["pg_dump", "pg_restore", "psql", "tar"].every((cmd) => spawnSync(cmd, ["--version"], { stdio: "ignore" }).status === 0);
  return tools;
}

// One heavy operation at a time (backup, restore or update), per server process.
type Busy = { op: "backup" | "restore" | "update"; since: Date } | null;
let busy: Busy = null;
export const busyState = () => busy;

async function exclusive<T>(op: NonNullable<Busy>["op"], fn: () => Promise<T>): Promise<T> {
  if (busy) throw new BackupError("busy");
  busy = { op, since: new Date() };
  try {
    return await fn();
  } finally {
    busy = null;
  }
}

function run(cmd: string, args: string[], env?: NodeJS.ProcessEnv) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"], env: { ...process.env, ...env } });
    let err = "";
    child.stderr.on("data", (d) => (err = (err + d).slice(-4000)));
    child.on("error", (e) => reject(new BackupError("failed", `${cmd}: ${e.message}`)));
    child.on("close", (code) => (code === 0 ? resolve() : reject(new BackupError("failed", `${cmd} exited ${code}: ${err.trim()}`))));
  });
}

function output(cmd: string, args: string[]) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "ignore"] });
    let out = "";
    child.stdout.on("data", (d) => (out += d).length > 50_000_000 && child.kill());
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`${cmd} exited ${code}`))));
  });
}

/** DATABASE_URL without Prisma-only parameters, which libpq tools reject. */
function pgUrl() {
  const url = new URL(process.env.DATABASE_URL!);
  for (const p of ["schema", "connection_limit", "pool_timeout", "pgbouncer", "socket_timeout", "statement_cache_size"]) url.searchParams.delete(p);
  return url.toString();
}

async function localMigrations() {
  const dir = path.resolve(process.env.MIGRATIONS_DIR ?? "./prisma/migrations");
  const entries = await readdir(dir, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

function parseEnv(text: string) {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (i > 0 && !line.startsWith("#")) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}
const formatEnv = (vars: Record<string, string>) =>
  Object.entries(vars)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n") + "\n";

export type BackupInfo = { name: string; kind: BackupKind; createdAt: Date; version: string; size: number; encrypted: boolean };

export async function listBackups(): Promise<BackupInfo[]> {
  const names = await readdir(backupDir()).catch(() => [] as string[]);
  const out: BackupInfo[] = [];
  for (const name of names) {
    const b = parseBackupName(name);
    if (!b) continue;
    const s = await stat(path.join(backupDir(), name)).catch(() => null);
    if (s) out.push({ ...b, size: s.size, encrypted: await isEncrypted(path.join(backupDir(), name)).catch(() => false) });
  }
  return out.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/** Absolute path of an existing backup; the name must match the backup pattern (no path tricks). */
export async function backupPath(name: string) {
  if (!parseBackupName(name)) throw new BackupError("notFound");
  const full = path.join(backupDir(), name);
  if (!(await stat(full).catch(() => null))) throw new BackupError("notFound");
  return full;
}

async function doBackup(kind: BackupKind) {
  if (!backupsAvailable()) throw new BackupError("unavailable");
  const dir = backupDir();
  await mkdir(dir, { recursive: true });
  const name = backupFileName(kind, new Date(), APP_VERSION);
  const stage = await mkdtemp(path.join(dir, ".stage-"));
  const part = path.join(dir, `.${name}.part`);
  try {
    await run("pg_dump", ["--format=custom", "--no-owner", "--no-privileges", "--file", path.join(stage, "database.dump"), "--dbname", pgUrl()]);
    const migrations = await prisma.$queryRaw<{ migration_name: string }[]>`
      SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name`;
    const manifest = { app: "maintenance", format: FORMAT, version: APP_VERSION, kind, createdAt: new Date().toISOString(), migrations: migrations.map((m) => m.migration_name) };
    await writeFile(path.join(stage, "manifest.json"), JSON.stringify(manifest, null, 2));
    const secrets = Object.fromEntries(SECRET_KEYS.filter((k) => process.env[k]).map((k) => [k, process.env[k]!]));
    await writeFile(path.join(stage, "secrets.env"), formatEnv(secrets), { mode: 0o600 });
    const uploads = uploadRoot();
    await mkdir(uploads, { recursive: true });
    // Upload files go in under uploads/, through a symlink that -h follows (busybox tar has no --transform).
    await symlink(uploads, path.join(stage, "uploads"));
    await run("tar", ["-czhf", part, "-C", stage, "manifest.json", "database.dump", "secrets.env", "uploads"]);
    await chmod(part, 0o600); // holds the encryption keys
    const password = backupPassword();
    if (password) {
      await encryptFile(part, `${part}.enc`, password);
      await rename(`${part}.enc`, part);
    }
    await rename(part, path.join(dir, name));
  } finally {
    await rm(stage, { recursive: true, force: true });
    await rm(part, { force: true });
    await rm(`${part}.enc`, { force: true });
  }
  const removed = await prune();
  // Off-server copies (e-mail / cloud): in the background, except before an update, which replaces this
  // container right after — then they get up to 10 minutes to finish first.
  const copies = import("@/lib/backup-copies").then(({ copyBackup }) => copyBackup(path.join(dir, name), kind, removed));
  if (kind === "pre-update") await Promise.race([copies, new Promise((r) => setTimeout(r, COPY_WAIT_MS))]);
  return name;
}

const COPY_WAIT_MS = 10 * 60_000;

/** Deletes the backups the schedule no longer keeps; returns their names. */
async function prune() {
  const settings = await getServerSettings();
  const names = (await listBackups()).map((b) => b.name);
  const removed = backupsToPrune(names, settings.backups);
  for (const n of removed) await rm(path.join(backupDir(), n), { force: true });
  return removed;
}

export function createBackup(kind: BackupKind = "manual") {
  return exclusive("backup", () => doBackup(kind));
}

export async function deleteBackup(name: string) {
  await rm(await backupPath(name), { force: true });
}

type Manifest = { app: string; format: number; version: string; kind: string; createdAt: string; migrations: string[] };

/** Runs `fn` on the plain .tar.gz: the file itself, or a temporary decrypted copy of an encrypted backup. */
async function withPlainArchive<T>(file: string, fn: (plain: string) => Promise<T>): Promise<T> {
  if (!(await isEncrypted(file))) return fn(file);
  const plain = path.join(backupDir(), `.decrypt-${path.basename(file)}-${Date.now()}`);
  try {
    await decryptFile(file, plain, backupPassword());
    return await fn(plain);
  } catch (e) {
    throw e instanceof BackupCryptoError ? new BackupError(e.code) : e;
  } finally {
    await rm(plain, { force: true });
  }
}

async function extract(file: string) {
  const stage = await mkdtemp(path.join(backupDir(), ".restore-"));
  try {
    await withPlainArchive(file, (plain) => run("tar", ["-xzof", plain, "-C", stage, "--no-same-permissions"]));
    const manifest = JSON.parse(await readFile(path.join(stage, "manifest.json"), "utf8")) as Manifest;
    if (manifest.app !== "maintenance" || manifest.format !== FORMAT || !Array.isArray(manifest.migrations)) throw new BackupError("invalidBackup");
    return { stage, manifest };
  } catch (e) {
    await rm(stage, { recursive: true, force: true });
    throw e instanceof BackupError ? e : new BackupError("invalidBackup");
  }
}

/** Validates an archive (readable gzip/tar with a database dump) and returns its manifest, without unpacking it. */
export function inspectBackup(file: string) {
  return withPlainArchive(file, inspectPlain);
}

async function inspectPlain(file: string) {
  const members = await output("tar", ["-tzf", file]).catch(() => "");
  const names = new Set(members.split("\n").map((n) => n.replace(/^\.\//, "")));
  if (!names.has("manifest.json") || !names.has("database.dump")) throw new BackupError("invalidBackup");
  try {
    const manifest = JSON.parse(await output("tar", ["-xzOf", file, "manifest.json"])) as Manifest;
    if (manifest.app !== "maintenance" || manifest.format !== FORMAT || !Array.isArray(manifest.migrations)) throw new Error();
    return manifest;
  } catch {
    throw new BackupError("invalidBackup");
  }
}

async function restoreDatabase(dump: string) {
  // Start from an empty schema so tables added by newer migrations don't linger; the entrypoint
  // runs `prisma migrate deploy` on the restart that follows, bringing an older backup up to date.
  await run("psql", ["--dbname", pgUrl(), "-v", "ON_ERROR_STOP=1", "-q", "-c", "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"]);
  await run("pg_restore", ["--no-owner", "--no-privileges", "--exit-on-error", "--dbname", pgUrl(), dump]);
}

/** Puts back the backup's keys in DATA_DIR/secrets.env; returns keys that docker-compose overrides with other values. */
async function restoreSecrets(file: string) {
  const backup = parseEnv(await readFile(file, "utf8").catch(() => ""));
  const target = path.join(dataDir(), "secrets.env");
  const current = parseEnv(await readFile(target, "utf8").catch(() => ""));
  const overridden = SECRET_KEYS.filter((k) => backup[k] && process.env[k] && process.env[k] !== current[k] && process.env[k] !== backup[k]);
  await mkdir(dataDir(), { recursive: true });
  await writeFile(target, formatEnv({ ...current, ...backup }), { mode: 0o600 });
  return overridden;
}

/**
 * Replaces the database, uploaded files and keys with a backup's. A safety backup is taken first and
 * put back automatically if the database restore fails. The server must restart afterwards.
 */
export function restoreBackup(name: string) {
  return exclusive("restore", async () => {
    if (!backupsAvailable()) throw new BackupError("unavailable");
    const file = await backupPath(name);
    const { stage, manifest } = await extract(file);
    try {
      const known = new Set(await localMigrations());
      if (manifest.migrations.some((m) => !known.has(m))) throw new BackupError("backupNewer", manifest.version);

      const safety = await doBackup("pre-restore");
      try {
        await restoreDatabase(path.join(stage, "database.dump"));
      } catch (e) {
        const back = await extract(path.join(backupDir(), safety));
        try {
          await restoreDatabase(path.join(back.stage, "database.dump"));
        } finally {
          await rm(back.stage, { recursive: true, force: true });
        }
        throw e;
      }

      await clearAllObjects();
      const uploads = path.join(stage, "uploads");
      if (await stat(uploads).catch(() => null)) await cp(uploads, uploadRoot(), { recursive: true });
      const overridden = await restoreSecrets(path.join(stage, "secrets.env"));
      console.warn(`[backup] restored ${name}; restarting`);
      return { safety, overridden };
    } finally {
      await rm(stage, { recursive: true, force: true });
    }
  });
}

/** In Docker the container restarts itself (restart: unless-stopped) and re-runs migrations. */
export function restartSoon() {
  if (process.env.APP_RUNTIME !== "docker") return false;
  setTimeout(() => process.exit(0), 1500);
  return true;
}

// ── Updates

export function updateNow() {
  return exclusive("update", async () => {
    if (backupsAvailable()) await doBackup("pre-update");
    await triggerUpdate();
  });
}

// ── Schedule (called every minute from instrumentation.ts)

const statePath = () => path.join(backupDir(), ".state.json");
const readState = async (): Promise<ScheduleState> => JSON.parse(await readFile(statePath(), "utf8").catch(() => "{}"));
async function writeState(s: ScheduleState) {
  await mkdir(backupDir(), { recursive: true });
  await writeFile(statePath(), JSON.stringify(s));
}

const RETRY_MS = 15 * 60_000;
const lastFailure = new Map<string, number>();

export async function runServerJobs(now = new Date()) {
  if (busy) return;
  const settings = await getServerSettings();
  const state = await readState();

  if (backupsAvailable()) {
    for (const kind of dueKinds(settings.backups, state, now)) {
      if (now.getTime() - (lastFailure.get(kind) ?? 0) < RETRY_MS) continue;
      try {
        const name = await createBackup(kind);
        state[kind] = slotOf(kind, now, settings.backups);
        await writeState(state);
        console.log(`[backup] ${name}`);
      } catch (e) {
        lastFailure.set(kind, now.getTime());
        console.error(`[backup] ${kind} backup failed`, e);
      }
    }
  }

  const slot = slotOf("daily", now, settings.backups);
  if (settings.autoUpdate && updaterConfigured() && state.autoUpdate !== slot && localHour(now, settings.backups.timezone) === settings.backups.hour) {
    state.autoUpdate = slot;
    await writeState(state);
    const status = await checkForUpdate(true);
    if (status.available) {
      console.log(`[update] updating to ${status.latest!.version}`);
      await updateNow().catch((e) => console.error("[update] automatic update failed", e));
    }
  }
}
