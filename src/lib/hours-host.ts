// An address that opens straight on the Hours section (e.g. horas.example.com): HOURS_HOST lists the host names,
// comma separated. It is the same app: only the start page differs (/hours instead of the dashboard), so a link or
// home-screen shortcut to that address lands on the hours. Pure: used by proxy.ts and the settings page.

/** The host names in HOURS_HOST, lower-case, without ports. */
export function hoursHosts(env: string | undefined = process.env.HOURS_HOST) {
  return (env ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase().replace(/:\d+$/, ""))
    .filter(Boolean);
}

/** The host a request was made to (behind a reverse proxy, the one it forwarded). */
export const requestHost = (h: { get(name: string): string | null }) => (h.get("x-forwarded-host") ?? h.get("host"))?.split(",")[0]?.trim() ?? null;

/** Whether a host is one of the Hours addresses. */
export function isHoursHost(host: string | null | undefined, env?: string) {
  if (!host) return false;
  return hoursHosts(env).includes(host.trim().toLowerCase().replace(/:\d+$/, ""));
}

/** The start page: /hours on an Hours address, else the dashboard. */
export const homePath = (hoursHost: boolean) => (hoursHost ? "/hours" : "/dashboard");
