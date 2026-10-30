// Start-up work for the Node.js server (loaded from instrumentation.ts only in that runtime).
export async function registerNode() {
  await seedOnFirstStart();
  startScheduler();
  startServerJobs();
  startConnectivityChecks();
}

// Villa internet checks (src/lib/connectivity.ts): every 30 s it checks the villas that are due under their
// company's interval (Settings → Technical). A run still going (slow or dead hosts) makes the next tick skip.
async function startConnectivityChecks() {
  const { runConnectivityChecks } = await import("@/lib/connectivity");
  const { TICK_SEC } = await import("@/lib/connectivity-rules");
  const g = globalThis as unknown as { __connectivity?: NodeJS.Timeout };
  if (g.__connectivity) clearInterval(g.__connectivity); // dev hot reload
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runConnectivityChecks();
    } catch (e) {
      console.error("[connectivity] check failed", e);
    } finally {
      running = false;
    }
  };
  g.__connectivity = setInterval(tick, TICK_SEC * 1000);
  setTimeout(tick, 45_000);
}

// Scheduled backups and automatic updates (see src/lib/backups.ts); checked every minute.
async function startServerJobs() {
  const { runServerJobs } = await import("@/lib/backups");
  const g = globalThis as unknown as { __serverJobs?: NodeJS.Timeout };
  if (g.__serverJobs) clearInterval(g.__serverJobs); // dev hot reload
  const tick = () => runServerJobs().catch((e) => console.error("[server-jobs]", e));
  g.__serverJobs = setInterval(tick, 60_000);
  setTimeout(tick, 30_000);
  startRetention();
}

// Retention clean-up (src/lib/retention.ts): shortly after start, then once a day.
async function startRetention() {
  const { runRetention } = await import("@/lib/retention");
  const g = globalThis as unknown as { __retention?: NodeJS.Timeout };
  if (g.__retention) clearInterval(g.__retention); // dev hot reload
  const tick = async () => {
    try {
      const r = await runRetention();
      const removed = Object.entries(r).filter(([, n]) => n > 0);
      if (removed.length) console.log(`[retention] ${removed.map(([k, n]) => `${k}: ${n}`).join(", ")}`);
    } catch (e) {
      console.error("[retention] clean-up failed", e);
    }
  };
  g.__retention = setInterval(tick, 24 * 60 * 60_000);
  setTimeout(tick, 2 * 60_000);
}

// Docker/demo servers: with SEED_DEMO=true an empty database gets the demo organization on first start.
async function seedOnFirstStart() {
  if (process.env.SEED_DEMO !== "true") return;
  try {
    const { prisma } = await import("@/lib/db/client");
    if (await prisma.organization.count()) return;
    const { seedDemo, DEMO_OWNER, DEMO_PASSWORD } = await import("@/lib/demo-seed");
    if (await seedDemo(prisma)) console.log(`[seed] demo data created: sign in with ${DEMO_OWNER} / ${DEMO_PASSWORD}`);
  } catch (e) {
    console.error("[seed] demo seed failed", e);
  }
}

// Optional in-process scheduler for self-hosted/dev servers. On serverless hosts leave
// SCHEDULER_INTERVAL_MINUTES unset and call /api/cron/pm from a cron service instead.
async function startScheduler() {
  const minutes = Number(process.env.SCHEDULER_INTERVAL_MINUTES);
  if (!minutes || minutes <= 0) return;

  const { runDueSchedules } = await import("@/lib/pm");
  const tick = async () => {
    try {
      const r = await runDueSchedules();
      if (r.created) console.log(`[pm] generated ${r.created} preventive work order(s)`);
    } catch (e) {
      console.error("[pm] scheduler run failed", e);
    }
  };
  const g = globalThis as unknown as { __pmTimer?: NodeJS.Timeout };
  if (g.__pmTimer) clearInterval(g.__pmTimer); // dev hot reload
  g.__pmTimer = setInterval(tick, minutes * 60_000);
  setTimeout(tick, 10_000);
}
