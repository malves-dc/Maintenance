import { requirePermission } from "@/lib/context";
import { redirectTo } from "@/lib/redirect";
import { getServerSettings, updateServerSettings } from "@/lib/server-settings";
import { checkOauthState } from "@/lib/backup-copies";
import { decryptField, encryptField } from "@/lib/crypto";
import { onedriveConnect } from "@/lib/cloud/onedrive";
import { gdriveConnect } from "@/lib/cloud/gdrive";
import { cloudRedirectUri } from "@/lib/cloud/oauth-paths";

// Where Microsoft / Google send the admin back after authorising: stores the (encrypted) refresh token.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (result: string, detail?: string) =>
    redirectTo(`/settings/server?cloud=${result}${detail ? `&detail=${encodeURIComponent(detail.slice(0, 200))}` : ""}#backup-copies`);
  // The server-admin unlock cookie is SameSite=Strict, so it isn't sent on the redirect back from Microsoft /
  // Google. The signed `state` stands in for it: it was issued to this user, unlocked, within the last 15 minutes.
  let userId: string;
  try {
    userId = (await requirePermission("org.manage")).user.id;
  } catch {
    return back("locked");
  }
  const provider = checkOauthState(url.searchParams.get("state") ?? "", userId);
  if (!provider) return back("badState");
  const error = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  const code = url.searchParams.get("code");
  if (error || !code) return back("denied", error ?? undefined);

  const s = (await getServerSettings()).backupCopies;
  const redirectUri = await cloudRedirectUri();
  try {
    if (provider === "onedrive") {
      const app = {
        tenant: s.cloud.onedrive.tenant,
        clientId: s.cloud.onedrive.clientId,
        clientSecret: s.cloud.onedrive.clientSecretEnc ? decryptField(s.cloud.onedrive.clientSecretEnc) : "",
        siteUrl: s.cloud.onedrive.siteUrl,
      };
      const r = await onedriveConnect(app, code, redirectUri);
      if (!r.refreshToken) return back("noRefresh");
      await updateServerSettings({ backupCopies: { ...s, cloud: { ...s.cloud, provider: "onedrive", onedrive: { ...s.cloud.onedrive, refreshTokenEnc: encryptField(r.refreshToken), account: r.account } } } });
    } else if (provider === "gdrive") {
      const app = { clientId: s.cloud.gdrive.clientId, clientSecret: s.cloud.gdrive.clientSecretEnc ? decryptField(s.cloud.gdrive.clientSecretEnc) : "" };
      const r = await gdriveConnect(app, code, redirectUri);
      if (!r.refreshToken) return back("noRefresh");
      await updateServerSettings({
        backupCopies: { ...s, cloud: { ...s.cloud, provider: "gdrive", gdrive: { ...s.cloud.gdrive, refreshTokenEnc: encryptField(r.refreshToken), account: r.account, folderId: null, folderPath: null } } },
      });
    } else return back("badState");
  } catch (e) {
    return back("failed", e instanceof Error ? e.message : String(e));
  }
  return back("connected");
}
