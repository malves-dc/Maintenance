import { check, encodePath, readChunk, type CloudTarget } from "./target";

// OneDrive / SharePoint through Microsoft Graph, with a delegated OAuth sign-in (an app registered once in
// Microsoft Entra ID). Large files go up in 10 MiB parts through an upload session.

const GRAPH = "https://graph.microsoft.com/v1.0";
/** SharePoint sites need Sites.ReadWrite.All, which personal Microsoft accounts reject: only ask for it with a site. */
export const onedriveScopes = (siteUrl: string) => `offline_access User.Read Files.ReadWrite.All${siteUrl ? " Sites.ReadWrite.All" : ""}`;
const CHUNK = 32 * 327_680; // 10 MiB, a multiple of 320 KiB as Graph requires

export type OneDriveApp = { tenant: string; clientId: string; clientSecret: string; siteUrl: string };

const authority = (tenant: string) => `https://login.microsoftonline.com/${encodeURIComponent(tenant || "common")}/oauth2/v2.0`;

export function onedriveAuthorizeUrl(app: Omit<OneDriveApp, "clientSecret">, redirectUri: string, state: string) {
  const q = new URLSearchParams({
    client_id: app.clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: onedriveScopes(app.siteUrl),
    state,
    prompt: "select_account",
  });
  return `${authority(app.tenant)}/authorize?${q}`;
}

async function token(app: OneDriveApp, params: Record<string, string>) {
  const res = await fetch(`${authority(app.tenant)}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: app.clientId, client_secret: app.clientSecret, scope: onedriveScopes(app.siteUrl), ...params }),
  });
  return (await (await check(res, "Microsoft sign-in")).json()) as { access_token: string; refresh_token?: string };
}

/** Code from the sign-in redirect → refresh token + the account's name. */
export async function onedriveConnect(app: OneDriveApp, code: string, redirectUri: string) {
  const t = await token(app, { grant_type: "authorization_code", code, redirect_uri: redirectUri });
  const res = await fetch(`${GRAPH}/me`, { headers: { Authorization: `Bearer ${t.access_token}` } });
  const me = (await (await check(res, "Microsoft account")).json()) as { userPrincipalName?: string; mail?: string };
  return { refreshToken: t.refresh_token ?? "", account: me.mail || me.userPrincipalName || null };
}

/**
 * A target for the signed-in account's OneDrive, or — with a SharePoint site URL — that site's document
 * library. `onRefresh` receives the new refresh token (Microsoft rotates them) so it can be stored.
 */
export function onedriveTarget(o: {
  app: OneDriveApp;
  refreshToken: string;
  folder: string;
  onRefresh: (token: string) => Promise<void>;
}): CloudTarget {
  let access: { token: string; drive: string } | null = null;

  async function session() {
    if (access) return access;
    const t = await token(o.app, { grant_type: "refresh_token", refresh_token: o.refreshToken });
    if (t.refresh_token && t.refresh_token !== o.refreshToken) await o.onRefresh(t.refresh_token);
    let drive = `${GRAPH}/me/drive`;
    if (o.app.siteUrl) {
      const u = new URL(o.app.siteUrl);
      const res = await fetch(`${GRAPH}/sites/${u.hostname}:${u.pathname.replace(/\/$/, "")}`, { headers: { Authorization: `Bearer ${t.access_token}` } });
      const site = (await (await check(res, "SharePoint site")).json()) as { id: string };
      drive = `${GRAPH}/sites/${site.id}/drive`;
    }
    access = { token: t.access_token, drive };
    return access;
  }
  const item = (drive: string, name?: string) => `${drive}/root:/${encodePath(name ? `${o.folder}/${name}` : o.folder)}`;

  return {
    async upload(file, name, size) {
      const s = await session();
      const res = await fetch(`${item(s.drive, name)}:/createUploadSession`, {
        method: "POST",
        headers: { Authorization: `Bearer ${s.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ item: { "@microsoft.graph.conflictBehavior": "replace" } }),
      });
      const { uploadUrl } = (await (await check(res, "OneDrive: upload session")).json()) as { uploadUrl: string };
      for (let offset = 0; offset < size; offset += CHUNK) {
        const chunk = await readChunk(file, offset, Math.min(CHUNK, size - offset));
        // The upload URL is pre-authorised: no Authorization header.
        const part = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Length": String(chunk.length), "Content-Range": `bytes ${offset}-${offset + chunk.length - 1}/${size}` },
          body: new Uint8Array(chunk),
        });
        await check(part, "OneDrive: upload");
      }
    },
    async list() {
      const s = await session();
      const res = await fetch(`${item(s.drive)}:/children?$select=name&$top=999`, { headers: { Authorization: `Bearer ${s.token}` } });
      if (res.status === 404) return [];
      const json = (await (await check(res, "OneDrive: listing")).json()) as { value: { name: string }[] };
      return json.value.map((v) => v.name);
    },
    async remove(name) {
      const s = await session();
      const res = await fetch(item(s.drive, name), { method: "DELETE", headers: { Authorization: `Bearer ${s.token}` } });
      if (res.status === 404) return;
      await check(res, "OneDrive: delete");
    },
  };
}
