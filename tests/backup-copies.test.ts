import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { cleanFolder, cloudReady, DEFAULT_BACKUP_COPIES, emailPlan, normalizeBackupCopies } from "@/lib/backup-copies-settings";
import { onedriveAuthorizeUrl, onedriveTarget } from "@/lib/cloud/onedrive";
import { driveQuote, gdriveAuthorizeUrl, gdriveTarget } from "@/lib/cloud/gdrive";
import { webdavTarget } from "@/lib/cloud/webdav";

const dir = await mkdtemp(path.join(tmpdir(), "copies-"));
afterAll(() => rm(dir, { recursive: true, force: true }));
afterEach(() => vi.unstubAllGlobals());

/** A file of `size` bytes for upload tests. */
async function file(size: number) {
  const f = path.join(dir, `f-${size}`);
  await writeFile(f, Buffer.alloc(size, 7));
  return f;
}

type Call = { url: string; method: string; headers: Record<string, string>; body?: unknown };
/** Replaces fetch with `handler`, recording every request. */
function mockFetch(handler: (c: Call) => Response) {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    const c: Call = { url: String(url), method: init.method ?? "GET", headers: Object.fromEntries(new Headers(init.headers).entries()), body: init.body };
    calls.push(c);
    return handler(c);
  });
  return calls;
}
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "Content-Type": "application/json" } });

describe("backup copy settings", () => {
  it("defaults to off, with daily/monthly/manual/pre-update chosen", () => {
    expect(normalizeBackupCopies(undefined)).toEqual(DEFAULT_BACKUP_COPIES);
    expect(normalizeBackupCopies({ email: { maxMb: 999, kinds: ["hourly", "nope"] } }).email).toMatchObject({ maxMb: 20, kinds: ["hourly"] });
  });

  it("cleans folder paths", () => {
    expect(cleanFolder(" /Backups//Maintenance/ ")).toBe("Backups/Maintenance");
    expect(cleanFolder("../a/./b\\c")).toBe("a/b/c");
  });

  it("decides what each backup's e-mail looks like", () => {
    const e = { enabled: true, to: ["a@b.pt"], kinds: ["daily" as const], encryptedOnly: true, maxMb: 20 };
    expect(emailPlan(e, { kind: "daily", size: 1000, encrypted: true })).toBe("attach");
    expect(emailPlan(e, { kind: "daily", size: 1000, encrypted: false })).toBe("notEncrypted");
    expect(emailPlan({ ...e, encryptedOnly: false }, { kind: "daily", size: 1000, encrypted: false })).toBe("attach");
    expect(emailPlan(e, { kind: "daily", size: 21 * 1024 * 1024, encrypted: true })).toBe("tooBig");
    expect(emailPlan(e, { kind: "monthly", size: 1000, encrypted: true })).toBe("skip"); // kind not chosen
    expect(emailPlan(e, { kind: "pre-restore", size: 1000, encrypted: true })).toBe("skip"); // never sent
    expect(emailPlan({ ...e, enabled: false }, { kind: "daily", size: 1000, encrypted: true })).toBe("skip");
  });

  it("needs a connected account for OneDrive / Google Drive", () => {
    const c = DEFAULT_BACKUP_COPIES.cloud;
    expect(cloudReady({ ...c, provider: "onedrive", onedrive: { ...c.onedrive, clientId: "x" } })).toBe(false);
    expect(cloudReady({ ...c, provider: "onedrive", onedrive: { ...c.onedrive, clientId: "x", refreshTokenEnc: "v1.t" } })).toBe(true);
    expect(cloudReady({ ...c, provider: "webdav", webdav: { ...c.webdav, url: "https://dav.example.com" } })).toBe(true);
    expect(cloudReady({ ...c, provider: "off" })).toBe(false);
  });
});

describe("OneDrive", () => {
  it("builds the sign-in link with offline access", () => {
    const u = new URL(onedriveAuthorizeUrl({ tenant: "common", clientId: "cid", siteUrl: "" }, "https://app.test/cb", "st"));
    expect(u.origin + u.pathname).toBe("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
    expect(u.searchParams.get("scope")).toContain("offline_access");
    expect(u.searchParams.get("redirect_uri")).toBe("https://app.test/cb");
  });

  it("only asks for SharePoint access with a site (personal accounts reject it)", () => {
    const scope = (siteUrl: string) => new URL(onedriveAuthorizeUrl({ tenant: "consumers", clientId: "c", siteUrl }, "https://app.test/cb", "st")).searchParams.get("scope");
    expect(scope("")).toBe("offline_access User.Read Files.ReadWrite.All");
    expect(scope("https://acme.sharepoint.com/sites/IT")).toContain("Sites.ReadWrite.All");
  });

  it("refreshes the token, uploads in 10 MiB parts with ranges, and stores a rotated refresh token", async () => {
    const size = 10 * 1024 * 1024 + 5;
    const f = await file(size);
    const calls = mockFetch((c) => {
      if (c.url.includes("/oauth2/v2.0/token")) return json({ access_token: "AT", refresh_token: "RT2" });
      if (c.url.endsWith(":/createUploadSession")) return json({ uploadUrl: "https://upload.test/session" });
      if (c.url === "https://upload.test/session") return json({}, 202);
      return json({}, 404);
    });
    const onRefresh = vi.fn(async () => {});
    await onedriveTarget({ app: { tenant: "common", clientId: "cid", clientSecret: "sec", siteUrl: "" }, refreshToken: "RT1", folder: "Backups/Main", onRefresh }).upload(f, "b.tar.gz", size);
    expect(onRefresh).toHaveBeenCalledWith("RT2");
    const session = calls.find((c) => c.url.endsWith(":/createUploadSession"))!;
    expect(session.url).toBe("https://graph.microsoft.com/v1.0/me/drive/root:/Backups/Main/b.tar.gz:/createUploadSession");
    expect(session.headers.authorization).toBe("Bearer AT");
    const parts = calls.filter((c) => c.url === "https://upload.test/session");
    expect(parts.map((p) => p.headers["content-range"])).toEqual([`bytes 0-10485759/${size}`, `bytes 10485760-${size - 1}/${size}`]);
    expect(parts.every((p) => !p.headers.authorization)).toBe(true);
  });

  it("uses a SharePoint site's library when a site URL is given", async () => {
    const calls = mockFetch((c) => {
      if (c.url.includes("/token")) return json({ access_token: "AT" });
      if (c.url.includes("/sites/acme.sharepoint.com:/sites/IT")) return json({ id: "site-1" });
      if (c.url.includes("/children")) return json({ value: [{ name: "a.tar.gz" }] });
      return json({}, 404);
    });
    const names = await onedriveTarget({ app: { tenant: "t", clientId: "c", clientSecret: "s", siteUrl: "https://acme.sharepoint.com/sites/IT/" }, refreshToken: "R", folder: "B", onRefresh: async () => {} }).list();
    expect(names).toEqual(["a.tar.gz"]);
    expect(calls.at(-1)!.url).toContain("/sites/site-1/drive/root:/B:/children");
  });
});

describe("Google Drive", () => {
  it("asks for offline access with the drive.file scope", () => {
    const u = new URL(gdriveAuthorizeUrl({ clientId: "cid" }, "https://app.test/cb", "st"));
    expect(u.searchParams.get("access_type")).toBe("offline");
    expect(u.searchParams.get("scope")).toContain("drive.file");
    expect(driveQuote("it's")).toBe("it\\'s");
  });

  it("creates the folder path once, then uploads resumably until the last part", async () => {
    const size = 8 * 1024 * 1024 + 3;
    const f = await file(size);
    const calls = mockFetch((c) => {
      if (c.url.includes("oauth2.googleapis.com/token")) return json({ access_token: "AT" });
      if (c.url.includes("/drive/v3/files?q=") && c.url.includes("mimeType")) return json({ files: [] });
      if (c.url.includes("/drive/v3/files?fields=id") && c.method === "POST") return json({ id: `folder-${calls.length}` });
      if (c.url.includes("/drive/v3/files?q=")) return json({ files: [] });
      if (c.url.includes("uploadType=resumable")) return new Response(null, { status: 200, headers: { location: "https://up.test/x" } });
      if (c.url === "https://up.test/x") return new Response(null, { status: (c.headers["content-range"] ?? "").startsWith("bytes 0-") ? 308 : 200 });
      return json({}, 404);
    });
    const onFolder = vi.fn(async () => {});
    await gdriveTarget({ app: { clientId: "c", clientSecret: "s" }, refreshToken: "R", folder: "Backups/Main", folderId: null, onFolder }).upload(f, "b.tar.gz", size);
    expect(calls.filter((c) => c.method === "POST" && c.url.includes("fields=id"))).toHaveLength(2); // Backups, then Main
    expect(onFolder).toHaveBeenCalledTimes(1);
    expect(calls.filter((c) => c.url === "https://up.test/x").map((c) => c.headers["content-range"])).toEqual([`bytes 0-8388607/${size}`, `bytes 8388608-${size - 1}/${size}`]);
  });
});

describe("WebDAV", () => {
  it("creates the folder, uploads with Basic auth and lists file names", async () => {
    const f = await file(100);
    const calls = mockFetch((c) => {
      if (c.method === "MKCOL") return new Response(null, { status: c.url.endsWith("/Backups") ? 405 : 201 });
      if (c.method === "PUT") return new Response(null, { status: 201 });
      if (c.method === "PROPFIND")
        return new Response(
          `<d:multistatus xmlns:d="DAV:"><d:response><d:href>/dav/Backups/Main/</d:href></d:response><d:response><d:href>/dav/Backups/Main/maintenance-daily-x.tar.gz</d:href></d:response></d:multistatus>`,
          { status: 207 },
        );
      return new Response(null, { status: 404 });
    });
    const t = webdavTarget({ url: "https://nas.test/dav", user: "u", password: "p", folder: "Backups/Main" });
    await t.upload(f, "maintenance-daily-x.tar.gz", 100);
    expect(calls.filter((c) => c.method === "MKCOL").map((c) => c.url)).toEqual(["https://nas.test/dav/Backups", "https://nas.test/dav/Backups/Main"]);
    const put = calls.find((c) => c.method === "PUT")!;
    expect(put.url).toBe("https://nas.test/dav/Backups/Main/maintenance-daily-x.tar.gz");
    expect(put.headers.authorization).toBe(`Basic ${Buffer.from("u:p").toString("base64")}`);
    expect(await t.list()).toEqual(["maintenance-daily-x.tar.gz"]);
    await t.remove("missing.tar.gz"); // 404 is fine
  });
});
