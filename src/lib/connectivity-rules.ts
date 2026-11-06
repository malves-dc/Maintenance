import { BlockList, isIP } from "node:net";

// Rules for the villa internet check (lib/connectivity.ts does the network part). A villa is online when its
// DynDNS name (or its address behind the VPN) answers a ping, or, when a port is set (for routers that drop
// pings from the internet), a TCP connection. A refused connection also counts: the router or device answered,
// only that port is closed.

export const PROBE_TIMEOUT_MS = 5000;

/** Choices for Settings → Technical, in seconds (the job runs every TICK_SEC, so that is the shortest). */
export const CHECK_INTERVALS = [30, 300, 1800, 3600, 43_200, 86_400] as const;
export const TICK_SEC = 30;

/** Whether a villa is due a check; a little slack so a 30 s interval isn't skipped every other tick. */
export function isDue(checkedAt: Date | null, intervalSec: number, now: Date): boolean {
  if (intervalSec <= 0) return false;
  if (!checkedAt) return true;
  return now.getTime() - checkedAt.getTime() >= (intervalSec - Math.min(10, intervalSec / 3)) * 1000;
}

/** Why a check failed (or the note on a success); each is a `connectivity.error.<code>` message. */
export type ProbeCode = "dnsFailed" | "timeout" | "unreachable" | "blockedAddress" | "failed" | "portClosed" | "noPing";

export type ProbeResult = { online: boolean; address?: string; latencyMs?: number; code?: ProbeCode };

/**
 * Reads the outcome of `ping -c 1` (iputils or busybox): exit 0 = a reply, with its time; otherwise why not.
 * `spawnError` is set when the command couldn't run at all (ENOENT: no ping on the server).
 */
export function parsePing(exitCode: number | null, output: string, spawnError?: string): Omit<ProbeResult, "address"> {
  if (spawnError) return { online: false, code: spawnError === "ENOENT" ? "noPing" : "failed" };
  if (exitCode === 0) {
    const ms = /time[=<]\s*([\d.]+)\s*ms/i.exec(output);
    return { online: true, latencyMs: ms ? Math.round(Number(ms[1])) : undefined };
  }
  if (/permission denied|not permitted|are you root/i.test(output)) return { online: false, code: "noPing" };
  if (/unreachable/i.test(output)) return { online: false, code: "unreachable" };
  return { online: false, code: exitCode === 1 ? "timeout" : "failed" };
}

const LABEL_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/i;

/** A DNS name (e.g. villa7.dyndns.org, or a single-label VPN name) or an IP address. */
export function isHostOrIp(v: string): boolean {
  const s = v.trim().replace(/\.$/, "");
  if (isIP(s)) return true;
  return s.length > 0 && s.length <= 253 && s.split(".").every((l) => LABEL_RE.test(l));
}

// The server itself and cloud metadata endpoints are never probed; private ranges are allowed (VPNs use them).
const blocked = new BlockList();
blocked.addSubnet("127.0.0.0", 8, "ipv4");
blocked.addSubnet("0.0.0.0", 8, "ipv4");
blocked.addSubnet("169.254.0.0", 16, "ipv4");
blocked.addAddress("::1", "ipv6");
blocked.addAddress("::", "ipv6");
blocked.addSubnet("fe80::", 10, "ipv6");

export function isBlockedAddress(ip: string): boolean {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped) return blocked.check(mapped[1], "ipv4");
  const family = isIP(ip);
  return family === 4 ? blocked.check(ip, "ipv4") : family === 6 ? blocked.check(ip, "ipv6") : true;
}

/** Maps a Node socket/DNS error to a failure code. */
export function errorCode(err: unknown): ProbeCode {
  const code = (err as { code?: string } | null)?.code;
  if (code === "ENOTFOUND" || code === "EAI_AGAIN" || code === "ENODATA" || code === "EAI_FAIL") return "dnsFailed";
  if (code === "ETIMEDOUT") return "timeout";
  if (code === "EHOSTUNREACH" || code === "ENETUNREACH" || code === "EHOSTDOWN" || code === "ENETDOWN") return "unreachable";
  return "failed";
}

/** The villa fields to store after a check; `onlineSince` moves only when the state changes. */
export function resultUpdate(prev: { online: boolean | null; onlineSince: Date | null }, r: ProbeResult, now: Date) {
  return {
    online: r.online,
    onlineCheckedAt: now,
    onlineSince: prev.online === r.online && prev.onlineSince ? prev.onlineSince : now,
    onlineLatencyMs: r.latencyMs ?? null,
    onlineAddress: r.address ?? null,
    onlineError: r.code ?? null,
  };
}

/** Clears the last result (the connection settings changed, so it no longer applies). */
export const NO_RESULT = {
  online: null,
  onlineCheckedAt: null,
  onlineSince: null,
  onlineLatencyMs: null,
  onlineAddress: null,
  onlineError: null,
};
