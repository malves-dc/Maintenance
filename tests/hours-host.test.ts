import { describe, expect, it } from "vitest";
import { homePath, hoursHosts, isHoursHost, requestHost } from "@/lib/hours-host";

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
