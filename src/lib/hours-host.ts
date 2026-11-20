// The Hours section can have its own address (e.g. horas.example.com): HOURS_HOST lists the host names, comma
// separated. On such a host the proxy sends everything but /horas, sign-in, one's profile and the app's own files to
// /horas, the menu shows only those, and /horas installs as its own app (manifest under /horas). Pure: used by
// proxy.ts, the app layout and the pages.

/** The host names in HOURS_HOST, lower-case, without ports. */
export function hoursHosts(env: string | undefined = process.env.HOURS_HOST) {
  return (env ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase().replace(/:\d+$/, ""))
    .filter(Boolean);
}

/** The host a request was made to (behind a reverse proxy, the one it forwarded). */
export const requestHost = (h: { get(name: string): string | null }) => (h.get("x-forwarded-host") ?? h.get("host"))?.split(",")[0] ?? null;

/** Whether a request's Host header is one of the Hours hosts. */
export function isHoursHost(host: string | null | undefined, env?: string) {
  if (!host) return false;
  return hoursHosts(env).includes(host.trim().toLowerCase().replace(/:\d+$/, ""));
}

// Paths that stay reachable on an Hours host; everything else goes to /horas.
const ALLOWED = [
  /^\/horas(\/|$)/,
  /^\/(login|forgot-password|reset-password|session|account|privacy|terms|invite|onboarding|portal|notifications)(\/|$)/,
  /^\/settings\/profile(\/|$)/,
  /^\/api\//,
  /^\/(sw\.js|offline\.html|favicon\.ico|icons\/)/,
];

/** Menu entries kept on an Hours host. */
export const hoursHostNav = (href: string) => href === "/horas" || href.startsWith("/horas/") || href === "/settings/profile";

/** Where a path on an Hours host goes: null = serve it, else the path to redirect to. */
export function hoursHostRedirect(pathname: string): string | null {
  return ALLOWED.some((re) => re.test(pathname)) ? null : "/horas";
}
