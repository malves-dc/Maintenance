"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { AlertTriangle, ChevronRight, CloudOff, LayoutDashboard, RefreshCw, ScanLine, Search, X } from "lucide-react";
import { WorkOrderStatusBadge, PriorityText } from "@/components/badges";
import { qrTokenOf, Scanner } from "@/components/scanner";
import type { NewOp, OfflineWorkOrder, QueuedOp, Snapshot } from "@/lib/offline-types";
import { applyOps } from "@/lib/offline/apply";
import { blobs, kv, newId, queue } from "@/lib/offline/idb";
import { clearIssues, loadIssues, loadSnapshot, syncNow, type SyncIssue, type SyncOutcome } from "@/lib/offline/sync";
import { cn } from "@/lib/utils";
import { bucketOf, scheduledAt } from "@/lib/wo-schedule";
import { WorkOrderView } from "./work-order-view";
import { SearchView } from "./search-view";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Theme } from "@/lib/theme";
import { preloadVideoConverter } from "@/lib/video-client";

/** The device timer; `mode` is missing on timers saved before on-site / remote existed (= on site). */
export type Timer = { woId: string; startedAt: string; mode?: "ONSITE" | "REMOTE" } | null;
type Status = "idle" | "syncing" | SyncOutcome["state"];

const SYNC_EVERY_MS = 60_000;

/** Tell the service worker to keep this page and the scripts it loaded, so it opens offline next time. */
function warmCache() {
  if (!("serviceWorker" in navigator)) return;
  const assets = performance
    .getEntriesByType("resource")
    .map((e) => e.name)
    .filter((u) => u.startsWith(location.origin) && new URL(u).pathname.startsWith("/_next/static/"));
  navigator.serviceWorker.ready.then((reg) => reg.active?.postMessage({ type: "cache-field", urls: ["/m", ...assets] })).catch(() => undefined);
}

export function FieldApp({ user, org, logo, theme }: { user: { id: string; name: string }; org: string; logo: string | null; theme: Theme }) {
  const t = useTranslations();
  const format = useFormatter();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  // The search words while the search screen is open (#search=<words>), else null.
  const [searchQ, setSearchQ] = useState<string | null>(null);
  const fromSearch = useRef(false);
  const [ops, setOps] = useState<QueuedOp[]>([]);
  const [issues, setIssues] = useState<SyncIssue[]>([]);
  const [timer, setTimerState] = useState<Timer>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [loaded, setLoaded] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [assetFilter, setAssetFilter] = useState<{ id: string | null; name: string; token: string } | null>(null);
  const syncing = useRef(false);
  const seq = useRef(0);

  const reload = useCallback(async () => {
    const [snap, rows, iss] = await Promise.all([loadSnapshot(user.id), queue.all<QueuedOp>(user.id), loadIssues(user.id)]);
    if (snap) setSnapshot(snap);
    setOps(rows.map((r) => r.op));
    setIssues(iss);
  }, [user.id]);

  const sync = useCallback(async () => {
    if (syncing.current) return;
    syncing.current = true;
    setStatus("syncing");
    try {
      const outcome = await syncNow(user.id);
      setStatus(outcome.state === "ok" ? "idle" : outcome.state);
    } catch {
      setStatus("failed");
    } finally {
      syncing.current = false;
      await reload();
    }
  }, [user.id, reload]);

  // Load the video converter now, so the service worker has it cached when there is no signal.
  useEffect(() => void preloadVideoConverter(), []);

  // Open from the device first, then refresh from the server.
  useEffect(() => {
    let alive = true;
    (async () => {
      await reload();
      const saved = await kv.get<Timer>(`timer:${user.id}`);
      if (!alive) return;
      setTimerState(saved ?? null);
      setLoaded(true);
      await sync();
      warmCache();
    })();
    const onOnline = () => void sync();
    const onVisible = () => document.visibilityState === "visible" && void sync();
    const onOffline = () => setStatus("offline");
    const every = setInterval(() => navigator.onLine && void sync(), SYNC_EVERY_MS);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearInterval(every);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [reload, sync, user.id]);

  // #wo=<id> keeps the open work order in the URL, so the back button works; #search=<words> the search.
  useEffect(() => {
    let wasSearch = false;
    const read = () => {
      const h = new URLSearchParams(location.hash.slice(1));
      setOpenId(h.get("wo"));
      setSearchQ(h.get("search"));
      // A job opened from the search goes back to the search.
      fromSearch.current = h.has("wo") && wasSearch;
      wasSearch = h.has("search");
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  const open = (id: string | null) => {
    location.hash = id ? `wo=${id}` : "";
    window.scrollTo(0, 0);
  };

  /** Queue a change (applied locally at once) and try to send it. */
  const enqueue = useCallback(
    async (op: NewOp, blob?: Blob) => {
      const full = { ...op, id: newId(), at: op.at ?? new Date().toISOString() } as QueuedOp;
      if (blob && full.kind === "photo") await blobs.set(full.blobKey, blob);
      await queue.put({ id: full.id, userId: user.id, seq: Date.now() * 1000 + (seq.current++ % 1000), op: full });
      setOps((prev) => [...prev, full]);
      if (navigator.onLine) setTimeout(() => void sync(), 800);
    },
    [user.id, sync],
  );

  const setTimer = useCallback(
    async (next: Timer) => {
      if (next) await kv.set(`timer:${user.id}`, next);
      else await kv.del(`timer:${user.id}`);
      setTimerState(next);
    },
    [user.id],
  );

  const workOrders = useMemo(() => (snapshot ? applyOps(snapshot, ops, user.name) : []), [snapshot, ops, user.name]);
  const current = workOrders.find((w) => w.id === openId) ?? null;
  const list = assetFilter ? workOrders.filter((w) => w.asset?.id === assetFilter.id) : workOrders;
  // To do now (overdue, today or undated), the next 30 days, and later — in this device's time zone.
  const sections = useMemo(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const now = new Date();
    const by = { now: [] as OfflineWorkOrder[], next30: [] as OfflineWorkOrder[], later: [] as OfflineWorkOrder[] };
    for (const w of list) by[bucketOf({ startDate: w.startDate ?? null, dueDate: w.dueDate, status: w.status }, now, tz)].push(w);
    // Jobs already in progress first.
    by.now.sort((a, b) => Number(b.status === "IN_PROGRESS") - Number(a.status === "IN_PROGRESS"));
    const at = (w: OfflineWorkOrder) => scheduledAt({ startDate: w.startDate ?? null, dueDate: w.dueDate })?.getTime() ?? 0;
    by.next30.sort((a, b) => at(a) - at(b));
    by.later.sort((a, b) => at(a) - at(b));
    return (["now", "next30", "later"] as const).map((key) => ({ key, items: by[key] })).filter((s) => s.items.length > 0);
  }, [list]);

  const onScan = useCallback(
    (text: string) => {
      setScanning(false);
      const token = qrTokenOf(text);
      const asset = snapshot?.assets.find((a) => a.qrToken === token);
      if (token) setAssetFilter({ id: asset?.id ?? null, name: asset ? `${asset.name} · ${asset.villa}` : t("field.unknownAsset"), token });
      else setAssetFilter({ id: null, name: text, token: "" });
      open(null);
    },
    [snapshot, t],
  );

  const pending = ops.length;
  const banner =
    status === "offline"
      ? { tone: "bg-amber-50 text-amber-900", text: t("field.offline", { count: pending }) }
      : status === "signedOut"
        ? { tone: "bg-red-50 text-red-800", text: t("field.signedOut") }
        : status === "failed"
          ? { tone: "bg-red-50 text-red-800", text: t("field.syncFailed") }
          : pending > 0
            ? { tone: "bg-sky-50 text-sky-900", text: t("field.pending", { count: pending }) }
            : null;

  return (
    <div className="mx-auto min-h-screen max-w-2xl bg-background pb-16">
      <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur">
        <div className="flex h-14 items-center gap-2 px-4">
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="size-8 shrink-0 rounded bg-white object-contain" />
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-brand">{org}</div>
            <div className="truncate text-xs text-muted">
              {snapshot ? t("field.lastSync", { when: format.relativeTime(new Date(snapshot.at), new Date()) }) : t("field.title")}
            </div>
          </div>
          <button onClick={() => (location.hash = "search=")} className="rounded-md p-2.5 hover:bg-gray-100" aria-label={t("search.title")} title={t("search.title")}>
            <Search className="size-5" />
          </button>
          <button onClick={() => setScanning(true)} className="rounded-md p-2.5 hover:bg-gray-100" aria-label={t("scan.title")} title={t("scan.title")}>
            <ScanLine className="size-5" />
          </button>
          <button
            onClick={() => void sync()}
            disabled={status === "syncing"}
            className="rounded-md p-2.5 hover:bg-gray-100 disabled:opacity-50"
            aria-label={t("field.syncNow")}
            title={t("field.syncNow")}
          >
            <RefreshCw className={cn("size-5", status === "syncing" && "animate-spin")} />
          </button>
          <a href="/dashboard" className="rounded-md p-2.5 hover:bg-gray-100" aria-label={t("field.fullApp")} title={t("field.fullApp")}>
            <LayoutDashboard className="size-5" />
          </a>
        </div>
        {banner && (
          <div className={cn("flex items-center gap-2 px-4 py-1.5 text-xs", banner.tone)}>
            {status === "offline" ? <CloudOff className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
            <span className="flex-1">{banner.text}</span>
            {status === "signedOut" && (
              <a href="/login?next=/m" className="font-medium underline">
                {t("auth.signIn")}
              </a>
            )}
          </div>
        )}
      </header>

      {issues.length > 0 && (
        <div className="mx-4 mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <div className="mb-1 flex items-center justify-between font-medium">
            {t("field.issues", { count: issues.length })}
            <button
              className="rounded p-1 hover:bg-red-100"
              aria-label={t("field.dismiss")}
              onClick={async () => {
                await clearIssues(user.id);
                setIssues([]);
              }}
            >
              <X className="size-4" />
            </button>
          </div>
          <ul className="space-y-0.5 text-xs">
            {issues.map((i) => {
              const wo = workOrders.find((w) => w.id === i.woId);
              return (
                <li key={i.id}>
                  {wo ? `#${wo.number} · ` : ""}
                  {t(`field.kind.${i.kind}` as never)}: {t.has(i.error as never) ? t(i.error as never) : t("common.somethingWrong")}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {current ? (
        <WorkOrderView
          wo={current}
          me={user.name}
          articles={current.villa?.id ? (snapshot?.knowledge ?? []).filter((a) => a.villaId === current.villa?.id) : []}
          members={snapshot?.members.filter((m) => m.id !== user.id) ?? []}
          timer={timer}
          setTimer={setTimer}
          enqueue={enqueue}
          onBack={() => (fromSearch.current ? history.back() : open(null))}
        />
      ) : searchQ !== null ? (
        <SearchView initial={searchQ} onDevice={new Set(workOrders.map((w) => w.id))} onBack={() => open(null)} />
      ) : (
        <main className="px-4 py-4">
          <div className="mb-3 flex items-baseline justify-between">
            <h1 className="text-lg font-semibold">{t("field.myWork")}</h1>
            <span className="text-xs text-muted">{t("field.count", { count: list.length })}</span>
          </div>

          {assetFilter && (
            <div className="mb-3 flex items-center gap-2 rounded-md bg-brand/10 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">
                {t("field.filteredBy")} <strong>{assetFilter.name}</strong>
              </span>
              {assetFilter.token && (
                <a href={`/r/${assetFilter.token}`} className="shrink-0 text-xs font-medium text-brand underline">
                  {t("field.openAsset")}
                </a>
              )}
              <button onClick={() => setAssetFilter(null)} className="rounded p-1 hover:bg-brand/10" aria-label={t("field.clearFilter")}>
                <X className="size-4" />
              </button>
            </div>
          )}

          {!loaded ? null : !snapshot ? (
            <p className="rounded-md border border-border bg-surface p-6 text-center text-sm text-muted">{t("field.firstLoad")}</p>
          ) : list.length === 0 ? (
            <p className="rounded-md border border-border bg-surface p-6 text-center text-sm text-muted">{assetFilter ? t("field.noneForAsset") : t("field.empty")}</p>
          ) : (
            <div className="space-y-5">
              {sections.map((s) => (
                <section key={s.key}>
                  <h2 className="mb-2 flex items-baseline justify-between text-xs font-semibold uppercase tracking-wide text-muted">
                    {t(`field.section.${s.key}`)}
                    <span className="font-normal normal-case">{s.items.length}</span>
                  </h2>
                  <ul className="space-y-2">
                    {s.items.map((w) => (
                      <li key={w.id}>
                        <WorkOrderCard wo={w} running={timer?.woId === w.id} onOpen={() => open(w.id)} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
          <p className="mt-6 text-center text-xs text-muted">{t("field.offlineHint")}</p>
          <div className="mt-4 flex justify-center">
            <ThemeToggle initial={theme} />
          </div>
        </main>
      )}

      {scanning && <Scanner onResult={onScan} onClose={() => setScanning(false)} />}
    </div>
  );
}

function WorkOrderCard({ wo, running, onOpen }: { wo: OfflineWorkOrder; running: boolean; onOpen: () => void }) {
  const t = useTranslations();
  const format = useFormatter();
  const steps = wo.items.filter((i) => i.type !== "HEADING");
  const answered = steps.filter((i) => i.value && i.value !== "false").length;
  const overdue = wo.dueDate && new Date(wo.dueDate) < new Date() && wo.status !== "DONE";
  return (
    <button onClick={onOpen} className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface p-4 text-left active:bg-gray-50">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">#{wo.number}</span>
          <WorkOrderStatusBadge status={wo.status} />
          <PriorityText priority={wo.priority} />
          {running && <span className="size-2 animate-pulse rounded-full bg-red-500" aria-label={t("field.timerRunning")} />}
        </div>
        <div className="mt-1 font-medium">{wo.title}</div>
        <div className="mt-0.5 truncate text-xs text-muted">{[wo.villa?.name, wo.area, wo.asset?.name].filter(Boolean).join(" · ")}</div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
          {wo.startDate && (
            <span className="text-muted">
              {t("wo.startDate")}: {format.dateTime(new Date(wo.startDate), { dateStyle: "medium", timeStyle: "short" })}
            </span>
          )}
          {wo.dueDate && (
            <span className={overdue ? "font-medium text-danger" : "text-muted"}>
              {t("wo.dueDate")}: {format.dateTime(new Date(wo.dueDate), { dateStyle: "medium", timeStyle: "short" })}
            </span>
          )}
          {steps.length > 0 && <span className="text-muted">{t("field.steps", { done: answered, total: steps.length })}</span>}
        </div>
      </div>
      <ChevronRight className="size-5 shrink-0 text-muted" />
    </button>
  );
}
