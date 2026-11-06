import { describe, expect, it } from "vitest";
import { CHECK_INTERVALS, errorCode, isBlockedAddress, isDue, isHostOrIp, NO_RESULT, parsePing, resultUpdate, TICK_SEC } from "@/lib/connectivity-rules";

describe("isHostOrIp", () => {
  it("accepts DynDNS names, VPN names and IPs", () => {
    for (const v of ["villa7.dyndns.org", "casa-01.duckdns.org.", "villa7", "10.8.0.17", "2001:db8::1"]) expect(isHostOrIp(v)).toBe(true);
  });
  it("rejects URLs and junk", () => {
    for (const v of ["https://villa7.dyndns.org", "villa7.dyndns.org:443", "-bad.example", "a..b", "", "with space.org"])
      expect(isHostOrIp(v)).toBe(false);
  });
});

describe("isBlockedAddress", () => {
  it("blocks the server itself and link-local (cloud metadata)", () => {
    for (const ip of ["127.0.0.1", "127.8.9.10", "0.0.0.0", "169.254.169.254", "::1", "::", "fe80::1", "::ffff:127.0.0.1"])
      expect(isBlockedAddress(ip)).toBe(true);
  });
  it("allows public and private (VPN) addresses", () => {
    for (const ip of ["85.240.1.2", "10.8.0.17", "192.168.1.1", "100.64.0.5", "2001:db8::1", "::ffff:10.0.0.1"])
      expect(isBlockedAddress(ip)).toBe(false);
  });
  it("blocks anything that isn't an IP", () => {
    expect(isBlockedAddress("localhost")).toBe(true);
  });
});

describe("errorCode", () => {
  it("maps socket and DNS errors", () => {
    expect(errorCode({ code: "ENOTFOUND" })).toBe("dnsFailed");
    expect(errorCode({ code: "EAI_AGAIN" })).toBe("dnsFailed");
    expect(errorCode({ code: "ETIMEDOUT" })).toBe("timeout");
    expect(errorCode({ code: "EHOSTUNREACH" })).toBe("unreachable");
    expect(errorCode({ code: "ENETUNREACH" })).toBe("unreachable");
    expect(errorCode({ code: "ECONNRESET" })).toBe("failed");
    expect(errorCode(null)).toBe("failed");
  });
});

describe("resultUpdate", () => {
  const t0 = new Date("2026-10-30T08:00:00Z");
  const now = new Date("2026-10-30T09:00:00Z");

  it("keeps onlineSince while the state holds", () => {
    const d = resultUpdate({ online: true, onlineSince: t0 }, { online: true, address: "1.2.3.4", latencyMs: 30 }, now);
    expect(d).toEqual({ online: true, onlineCheckedAt: now, onlineSince: t0, onlineLatencyMs: 30, onlineAddress: "1.2.3.4", onlineError: null });
  });
  it("moves onlineSince when it changes, and on the first check", () => {
    expect(resultUpdate({ online: true, onlineSince: t0 }, { online: false, code: "timeout" }, now)).toMatchObject({
      online: false,
      onlineSince: now,
      onlineError: "timeout",
      onlineLatencyMs: null,
    });
    expect(resultUpdate({ online: null, onlineSince: null }, { online: true }, now).onlineSince).toBe(now);
  });
  it("NO_RESULT clears every result field", () => {
    expect(Object.keys(NO_RESULT).sort()).toEqual(Object.keys(resultUpdate({ online: null, onlineSince: null }, { online: true }, now)).sort());
  });
});

describe("isDue", () => {
  const now = new Date("2026-10-30T09:00:00Z");
  const ago = (s: number) => new Date(now.getTime() - s * 1000);

  it("is off at 0 and due when never checked", () => {
    expect(isDue(null, 0, now)).toBe(false);
    expect(isDue(null, 300, now)).toBe(true);
  });
  it("30 s checks run on every tick, even when the last check finished a few seconds into the tick", () => {
    expect(isDue(ago(TICK_SEC - 5), 30, now)).toBe(true);
    expect(isDue(ago(10), 30, now)).toBe(false);
  });
  it("longer intervals wait until (about) the interval has passed", () => {
    expect(isDue(ago(250), 300, now)).toBe(false);
    expect(isDue(ago(295), 300, now)).toBe(true);
    expect(isDue(ago(86_000), 86_400, now)).toBe(false);
    expect(isDue(ago(86_395), 86_400, now)).toBe(true);
  });
  it("offers no interval shorter than the job's tick", () => {
    expect(Math.min(...CHECK_INTERVALS)).toBeGreaterThanOrEqual(TICK_SEC);
  });
});

describe("parsePing", () => {
  it("reads the reply time from busybox and iputils", () => {
    const busybox = "PING 85.240.0.1 (85.240.0.1): 56 data bytes\n64 bytes from 85.240.0.1: seq=0 ttl=57 time=8.348 ms\n";
    const iputils = "64 bytes from 85.240.0.1: icmp_seq=1 ttl=57 time=12.4 ms\n";
    expect(parsePing(0, busybox)).toEqual({ online: true, latencyMs: 8 });
    expect(parsePing(0, iputils)).toEqual({ online: true, latencyMs: 12 });
  });
  it("explains why there was no reply", () => {
    expect(parsePing(1, "1 packets transmitted, 0 packets received, 100% packet loss")).toEqual({ online: false, code: "timeout" });
    expect(parsePing(1, "From 10.8.0.1 icmp_seq=1 Destination Host Unreachable")).toEqual({ online: false, code: "unreachable" });
    expect(parsePing(1, "ping: permission denied (are you root?)")).toEqual({ online: false, code: "noPing" });
    expect(parsePing(null, "", "ENOENT")).toEqual({ online: false, code: "noPing" });
    expect(parsePing(2, "ping: bad address")).toEqual({ online: false, code: "failed" });
  });
});
