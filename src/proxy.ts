import { NextResponse, type NextRequest } from "next/server";
import { encode, getToken } from "next-auth/jwt";
import { homePath, isHoursHost, requestHost } from "@/lib/hours-host";
import { isPageLoad, needsRenewal, SESSION_MAX_AGE, sessionCookieName, usesSecureCookie } from "@/lib/session-cookie";

// Routes reachable without signing in.
const PUBLIC_PREFIXES = ["/login", "/signup", "/invite", "/forgot-password", "/factory-reset", "/reset-password/", "/r/", "/api/auth", "/api/cron/", "/sw.js", "/offline.html", "/manifest.webmanifest", "/api/org-logo/", "/api/version", "/privacy", "/terms", "/session/clear", "/api/calendar/", "/hours/manifest.webmanifest"]; // cron routes check CRON_SECRET

// The session is only read here (see lib/session-cookie.ts for why it isn't rewritten on every request).
export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // An Hours address (HOURS_HOST) starts on /hours; the rest of the app works there as anywhere.
  const home = homePath(isHoursHost(requestHost(req.headers)));
  if (pathname === "/" && home !== "/dashboard") return NextResponse.redirect(new URL(home, req.nextUrl));
  const secure = usesSecureCookie(req.headers, req.nextUrl.protocol);
  const cookieName = sessionCookieName(secure);
  const secret = process.env.AUTH_SECRET;
  const token = await getToken({ req, secret, secureCookie: secure, cookieName, salt: cookieName });

  const isPublic = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
  if (!token && !isPublic) {
    const url = new URL("/login", req.nextUrl);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (token && (pathname === "/login" || pathname === "/signup")) {
    return NextResponse.redirect(new URL(home, req.nextUrl));
  }

  const res = NextResponse.next();
  // Sliding session: on a full page load, once a day, re-issue the cookie with a fresh 30-day expiry.
  if (token && secret && isPageLoad(req.method, req.headers) && needsRenewal(token.iat)) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- iat/exp/jti are set afresh by encode()
    const { iat, exp, jti, ...claims } = token;
    const value = await encode({ token: claims, secret, salt: cookieName, maxAge: SESSION_MAX_AGE });
    res.cookies.set(cookieName, value, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: SESSION_MAX_AGE });
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|uploads/|api/server/backups/upload|api/uploads/video|.*\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
