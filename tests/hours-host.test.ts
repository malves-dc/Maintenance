import { describe, expect, it } from "vitest";
import { homePath, hoursHosts, isHoursHost, requestHost } from "@/lib/hours-host";
import { effectivePermissions, timesheetOnlyAllows } from "@/lib/rbac";

describe("hours: direct address", () => {
  const env = "horas.example.pt, Staging.Horas.example.pt:443";
  it("matches the listed hosts, whatever the case or port", () => {
    expect(hoursHosts(env)).toEqual(["horas.example.pt", "staging.horas.example.pt"]);
    expect(isHoursHost("HORAS.example.pt:3000", env)).toBe(true);
    expect(isHoursHost("app.example.pt", env)).toBe(false);
    expect(isHoursHost("horas.example.pt", "")).toBe(false);
  });
  it("prefers the forwarded host", () => {
    expect(requestHost(new Headers({ host: "10.0.0.5:3000", "x-forwarded-host": "horas.example.pt" }))).toBe("horas.example.pt");
    expect(requestHost(new Headers({ host: "app.example.pt" }))).toBe("app.example.pt");
  });
  it("starts on the hours there and on the dashboard elsewhere", () => {
    expect(homePath(true)).toBe("/hours");
    expect(homePath(false)).toBe("/dashboard");
  });
});

describe("hours: the hours-only role", () => {
  it("can only log its own hours: no staff app, nothing else", () => {
    expect([...effectivePermissions("TIMESHEET", { TECHNICIAN: ["internal.view"] })]).toEqual(["timesheets.log"]);
  });
  it("stays within the hours, its profile and notifications", () => {
    for (const p of ["/hours", "/hours/entries", "/hours/new", "/settings/profile", "/notifications", "/help"]) expect(timesheetOnlyAllows(p)).toBe(true);
    for (const p of ["/", "/dashboard", "/work-orders", "/villas/x", "/hoursx", "/settings/users", "/m"]) expect(timesheetOnlyAllows(p)).toBe(false);
  });
});
