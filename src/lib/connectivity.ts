import "server-only";
import { lookup } from "node:dns/promises";
import { execFile, type ExecFileException } from "node:child_process";
import { connect } from "node:net";
import { prisma } from "@/lib/db/client";
import {
  errorCode,
  isBlockedAddress,
  isDue,
  parsePing,
  PROBE_TIMEOUT_MS,
  resultUpdate,
  type ProbeResult,
} from "@/lib/connectivity-rules";

/** Resolves the host, then pings it (no port) or opens a TCP connection to the port (rules in lib/connectivity-rules.ts). */
export async function probe(host: string, port: number | null, timeoutMs = PROBE_TIMEOUT_MS): Promise<ProbeResult> {
  let address: string;
  try {
    const all = await lookup(host.trim(), { all: true });
    address = (all.find((a) => a.family === 4) ?? all[0]).address; // IPv4 first: many servers have no IPv6 route
  } catch (e) {
    return { online: false, code: errorCode(e) };
  }
  if (isBlockedAddress(address)) return { online: false, address, code: "blockedAddress" };
  return { address, ...(await (port ? tcpProbe(address, port, timeoutMs) : ping(address, timeoutMs))) };
}

/** One ICMP echo through the system `ping` (busybox in the image; works unprivileged under Docker's defaults). */
function ping(address: string, timeoutMs: number): Promise<Omit<ProbeResult, "address">> {
  const seconds = String(Math.max(1, Math.round(timeoutMs / 1000)));
  return new Promise((resolve) => {
    execFile("ping", ["-c", "1", "-W", seconds, address], { timeout: timeoutMs + 2000 }, (err, stdout, stderr) => {
      const e = err as (ExecFileException & { code?: string | number }) | null;
      const spawnError = typeof e?.code === "string" ? e.code : undefined;
      // Exit 1 = no reply; killed by our own timeout counts the same.
      const exitCode = !e ? 0 : typeof e.code === "number" ? e.code : e.killed ? 1 : null;
      resolve(parsePing(exitCode, `${stdout}\n${stderr}`, spawnError));
    });
  });
}

function tcpProbe(address: string, port: number, timeoutMs: number): Promise<Omit<ProbeResult, "address">> {
  const started = performance.now();
  const latencyMs = () => Math.round(performance.now() - started);
  return new Promise((resolve) => {
    const socket = connect({ host: address, port });
    const done = (r: Omit<ProbeResult, "address">) => {
      socket.destroy();
      resolve(r);
    };
    socket.setTimeout(timeoutMs, () => done({ online: false, code: "timeout" }));
    socket.once("connect", () => done({ online: true, latencyMs: latencyMs() }));
    socket.once("error", (e: NodeJS.ErrnoException) =>
      done(e.code === "ECONNREFUSED" ? { online: true, latencyMs: latencyMs(), code: "portClosed" } : { online: false, code: errorCode(e) }),
    );
  });
}

type Monitored = {
  connectivityHost: string | null;
  connectivityPort: number | null;
  online: boolean | null;
  onlineSince: Date | null;
};

/** Checks one villa and returns the fields to store (null when it isn't monitored). */
export async function checkVilla(villa: Monitored, now = new Date()) {
  if (!villa.connectivityHost) return null;
  return resultUpdate(villa, await probe(villa.connectivityHost, villa.connectivityPort), now);
}

const CONCURRENCY = 20;

// Background job (instrumentation-node.ts, every TICK_SEC): checks the monitored villas that are due under their
// company's interval (Settings → Technical), across every company, so it uses the raw client. Archived villas
// are skipped.
export async function runConnectivityChecks(now = new Date()) {
  const monitored = await prisma.villa.findMany({
    where: {
      archivedAt: null,
      connectivityType: { not: null },
      connectivityHost: { not: null },
      organization: { connectivityIntervalSec: { gt: 0 } },
    },
    select: {
      id: true,
      connectivityHost: true,
      connectivityPort: true,
      online: true,
      onlineSince: true,
      onlineCheckedAt: true,
      organization: { select: { connectivityIntervalSec: true } },
    },
  });
  const villas = monitored.filter((v) => isDue(v.onlineCheckedAt, v.organization.connectivityIntervalSec, now));
  let offline = 0;
  for (let i = 0; i < villas.length; i += CONCURRENCY) {
    await Promise.all(
      villas.slice(i, i + CONCURRENCY).map(async (v) => {
        const data = await checkVilla(v);
        if (!data) return;
        if (!data.online) offline++;
        await prisma.villa.update({ where: { id: v.id }, data });
      }),
    );
  }
  return { checked: villas.length, offline };
}
