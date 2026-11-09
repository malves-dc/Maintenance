"use client";

import { useEffect, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Camera, ChevronLeft, Video, CirclePause, CirclePlay, MapPin, Monitor, Send, Square } from "lucide-react";
import { Button } from "@/components/ui";
import { PriorityText, WorkOrderStatusBadge } from "@/components/badges";
import { MentionTextarea, type MentionMember } from "@/components/mention-textarea";
import { shrinkImage, UPLOAD_ERRORS } from "@/lib/upload-client";
import { prepareVideo } from "@/lib/video-client";
import { missingRequired } from "@/lib/offline/apply";
import { newId } from "@/lib/offline/idb";
import type { NewOp, OfflineArticle, OfflineWorkOrder } from "@/lib/offline-types";
import type { WorkOrderStatus } from "@/generated/prisma/enums";
import { SignaturePad, type SignaturePadHandle } from "@/components/signature-pad";
import { ChecklistItemInput } from "./checklist-item";
import { KnowledgeSection } from "./knowledge-view";
import { RequestChat } from "@/components/request-chat";
import type { Timer } from "./field-app";

type Enqueue = (op: NewOp, blob?: Blob) => Promise<void>;

function clock(sec: number) {
  return `${Math.floor(sec / 3600)}:${String(Math.floor((sec % 3600) / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
}

export function WorkOrderView({
  wo,
  me,
  articles,
  members,
  timer,
  setTimer,
  enqueue,
  onBack,
}: {
  wo: OfflineWorkOrder;
  /** My name, as in `wo.timeMissing`. */
  me: string;
  /** The villa's knowledge-base articles. */
  articles: OfflineArticle[];
  members: MentionMember[];
  timer: Timer;
  setTimer: (t: Timer) => Promise<void>;
  enqueue: Enqueue;
  onBack: () => void;
}) {
  const t = useTranslations();
  const format = useFormatter();
  const [now, setNow] = useState(() => Date.now());
  const [comment, setComment] = useState("");
  const [blocked, setBlocked] = useState<{ items: string[]; time: string[]; report: boolean; signOff: boolean } | null>(null);
  // The report being typed; queued on blur, and before "Done" so a tap straight from the box counts.
  const savedReport = wo.workReport ?? "";
  const [report, setReport] = useState(savedReport);
  const [shownSaved, setShownSaved] = useState(savedReport);
  if (shownSaved !== savedReport) {
    // A newer report arrived (synced, or queued from this box): show it.
    setShownSaved(savedReport);
    setReport(savedReport);
  }
  const saveReport = async () => {
    if (report.trim() !== savedReport) await enqueue({ kind: "report", woId: wo.id, text: report.trim() });
  };
  const [holdNote, setHoldNote] = useState<string | null>(null);
  const [mode, setMode] = useState<"ONSITE" | "REMOTE">("ONSITE");
  const photoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const [converting, setConverting] = useState<number | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const runningHere = timer?.woId === wo.id;
  const closed = wo.status === "DONE" || wo.status === "CANCELLED";

  useEffect(() => {
    if (!runningHere) return;
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, [runningHere]);

  /** Stop the device timer and queue the interval (anything under a minute is dropped). */
  const stopTimer = async () => {
    if (!timer) return;
    const end = new Date();
    if (end.getTime() - new Date(timer.startedAt).getTime() >= 60_000) {
      await enqueue({ kind: "time", woId: timer.woId, startedAt: timer.startedAt, endedAt: end.toISOString(), at: end.toISOString(), mode: timer.mode ?? "ONSITE" });
    }
    await setTimer(null);
  };

  const setStatus = async (status: WorkOrderStatus, note?: string) => {
    if (status === "DONE") {
      await saveReport();
      const items = missingRequired(wo).map((i) => i.label);
      // The server enforces these too: everyone's time, the technician's report, and a signature or "client absent".
      // A timer running here counts: it is stopped and queued below.
      const time = (wo.timeMissing ?? []).filter((name) => !(runningHere && name === me));
      const needsReport = !report.trim();
      const signOff = !wo.signOff && !wo.clientAbsent;
      if (items.length || time.length || needsReport || signOff) {
        setBlocked({ items, time, report: needsReport, signOff });
        return;
      }
    }
    setBlocked(null);
    if ((status === "DONE" || status === "ON_HOLD") && runningHere) await stopTimer();
    await enqueue({ kind: "status", woId: wo.id, status, note: note ?? null });
  };

  const addPhotos = async (files: FileList | null) => {
    for (const f of [...(files ?? [])]) {
      const small = await shrinkImage(f);
      await enqueue({ kind: "photo", woId: wo.id, itemId: null, blobKey: newId(), filename: small.name }, small);
    }
  };

  /** Videos are converted on the device (small 720p MP4), then queued like photos. */
  const addVideos = async (files: FileList | null) => {
    setVideoError(null);
    for (const f of [...(files ?? [])]) {
      try {
        setConverting(0);
        const video = await prepareVideo(f, (p) => setConverting(Math.round(p * 100)));
        await enqueue({ kind: "photo", woId: wo.id, itemId: null, blobKey: newId(), filename: video.name }, video);
      } catch (e) {
        const code = e instanceof Error ? e.message : "";
        setVideoError(UPLOAD_ERRORS.includes(code) ? code : "failed");
      } finally {
        setConverting(null);
      }
    }
  };

  const elapsed = runningHere ? Math.max(0, Math.floor((now - new Date(timer!.startedAt).getTime()) / 1000)) : 0;
  const address = [wo.villa?.address, wo.villa?.city].filter(Boolean).join(", ");

  return (
    <main className="pb-6">
      <div className="border-b border-border bg-surface px-4 py-3">
        <button onClick={onBack} className="-ml-1 mb-2 inline-flex items-center gap-1 text-sm text-muted">
          <ChevronLeft className="size-4" />
          {t("field.myWork")}
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted">{wo.number}</span>
          <WorkOrderStatusBadge status={wo.status} />
          <PriorityText priority={wo.priority} />
        </div>
        <h1 className="mt-1 text-lg font-semibold">{wo.title}</h1>
        {wo.dueDate && (
          <p className="text-xs text-muted">
            {t("wo.dueDate")}: {format.dateTime(new Date(wo.dueDate), { dateStyle: "medium", timeStyle: "short" })}
          </p>
        )}
      </div>

      <section className="space-y-2 border-b border-border bg-surface px-4 py-3 text-sm">
        {wo.villa && (
          <div>
            <div className="font-medium">
              {wo.villa.name}
              {wo.area && <span className="font-normal text-muted"> · {wo.area}</span>}
            </div>
            {address && (
              <a href={`https://maps.google.com/?q=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-brand">
                <MapPin className="size-3.5" />
                {address}
              </a>
            )}
          </div>
        )}
        {wo.villa?.accessNotes && (
          <p className="whitespace-pre-wrap rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <span className="font-medium">{t("field.access")}: </span>
            {wo.villa.accessNotes}
          </p>
        )}
        {wo.asset && (
          <div className="text-xs">
            <span className="text-muted">{t("wo.asset")}: </span>
            <span className="font-medium">{wo.asset.name}</span>
            {wo.asset.details && <span className="text-muted"> · {wo.asset.details}</span>}
          </div>
        )}
        {wo.description && <p className="whitespace-pre-wrap pt-1">{wo.description}</p>}
      </section>

      {articles.length > 0 && <KnowledgeSection articles={articles} assetId={wo.asset?.id ?? null} />}

      {!closed && (
        <section className="space-y-3 border-b border-border bg-surface px-4 py-3">
          <div className="grid grid-cols-2 gap-2">
            {wo.status === "OPEN" && (
              <Button variant="secondary" onClick={() => setStatus("EN_ROUTE")} className="h-12">
                {t("woStatus.EN_ROUTE")}
              </Button>
            )}
            {(wo.status === "OPEN" || wo.status === "EN_ROUTE") && (
              <Button onClick={() => setStatus("IN_PROGRESS")} className={wo.status === "OPEN" ? "h-12" : "col-span-2 h-12"}>
                {t("field.start")}
              </Button>
            )}
            {wo.status === "ON_HOLD" && (
              <Button onClick={() => setStatus("IN_PROGRESS")} className="col-span-2 h-12">
                {t("field.resume")}
              </Button>
            )}
            {wo.status === "IN_PROGRESS" && (
              <>
                <Button variant="secondary" onClick={() => setHoldNote("")} className="h-12">
                  {t("field.hold")}
                </Button>
                <Button onClick={() => setStatus("DONE")} className="h-12">
                  {t("field.done")}
                </Button>
              </>
            )}
          </div>
          {holdNote !== null && (
            <div className="space-y-2 rounded-md border border-border p-3">
              <input
                value={holdNote}
                onChange={(e) => setHoldNote(e.target.value)}
                placeholder={t("wo.holdReason")}
                className="h-11 w-full rounded-md border border-border px-3 text-sm"
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={async () => {
                    await setStatus("ON_HOLD", holdNote);
                    setHoldNote(null);
                  }}
                >
                  {t("field.hold")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setHoldNote(null)}>
                  {t("common.cancel")}
                </Button>
              </div>
            </div>
          )}
          {blocked && (
            <div className="space-y-1 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
              {blocked.items.length > 0 && (
                <>
                  {t("wo.requiredItems")}
                  <ul className="mt-1 list-disc pl-5 text-xs">
                    {blocked.items.map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                </>
              )}
              {blocked.time.length > 0 && <p>{t("time.missing", { names: blocked.time.join(", ") })}</p>}
              {blocked.report && <p>{t("wo.reportRequired")}</p>}
              {blocked.signOff && <p>{t("wo.signOffRequired")}</p>}
            </div>
          )}

          {!runningHere && (
            <div role="radiogroup" aria-label={t("time.mode")} className="grid grid-cols-2 rounded-md border border-border p-0.5 text-sm">
              {(["ONSITE", "REMOTE"] as const).map((m) => {
                const Icon = m === "ONSITE" ? MapPin : Monitor;
                return (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={mode === m}
                    onClick={() => setMode(m)}
                    className={`inline-flex h-9 items-center justify-center gap-1.5 rounded ${mode === m ? "bg-brand text-white" : "text-muted"}`}
                  >
                    <Icon className="size-4" />
                    {t(`time.modes.${m}`)}
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex items-center gap-3">
            {runningHere ? (
              <Button variant="danger" onClick={stopTimer} className="h-11 flex-1">
                <Square className="size-4" />
                {t("time.stop")} <span className="font-mono tabular-nums">{clock(elapsed)}</span>
                <span className="text-xs font-normal opacity-90">· {t(`time.modes.${timer!.mode ?? "ONSITE"}`)}</span>
              </Button>
            ) : (
              <Button
                variant="secondary"
                className="h-11 flex-1"
                onClick={async () => {
                  if (timer) await stopTimer(); // one timer at a time
                  await setTimer({ woId: wo.id, startedAt: new Date().toISOString(), mode });
                  if (wo.status === "OPEN" || wo.status === "EN_ROUTE" || wo.status === "ON_HOLD") await enqueue({ kind: "status", woId: wo.id, status: "IN_PROGRESS" });
                }}
              >
                {timer ? <CirclePause className="size-4" /> : <CirclePlay className="size-4" />}
                {t("time.start")}
              </Button>
            )}
            <span className="text-xs text-muted">{t("field.logged", { minutes: wo.minutesLogged })}</span>
          </div>
        </section>
      )}

      {wo.items.length > 0 && (
        <section className="mt-3 border-y border-border bg-surface">
          <h2 className="px-4 pt-3 text-sm font-medium">{t("checklist.title")}</h2>
          <ul className="divide-y divide-border">
            {wo.items.map((item) => (
              <li key={item.id} className="px-4 py-3">
                <ChecklistItemInput item={item} locked={closed} woId={wo.id} enqueue={enqueue} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-3 border-y border-border bg-surface px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium">{t("field.photos")}</h2>
          <input ref={photoInput} type="file" accept="image/*" capture="environment" multiple className="sr-only" onChange={(e) => void addPhotos(e.target.files).then(() => (e.target.value = ""))} />
          <input ref={videoInput} type="file" accept="video/*" capture="environment" className="sr-only" onChange={(e) => void addVideos(e.target.files).then(() => (e.target.value = ""))} />
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => photoInput.current?.click()}>
              <Camera className="size-4" />
              {t("field.takePhoto")}
            </Button>
            <Button size="sm" variant="secondary" disabled={converting !== null} onClick={() => videoInput.current?.click()}>
              <Video className="size-4" />
              {converting !== null ? t("files.converting", { progress: converting }) : t("field.takeVideo")}
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted">{t("field.photosHint")}</p>
        {videoError && <p className="mt-1 text-xs text-danger">{t(`files.${videoError}`)}</p>}
      </section>

      <section className="mt-3 border-y border-border bg-surface px-4 py-3">
        <h2 className="text-sm font-medium">
          <label htmlFor="work-report">{t("workReport.title")}</label>
        </h2>
        {closed ? (
          <p className="mt-1 whitespace-pre-wrap text-sm">{savedReport || <span className="text-muted">—</span>}</p>
        ) : (
          <>
            <p className="mb-2 text-xs text-muted">{t("workReport.hint")}</p>
            <textarea
              id="work-report"
              value={report}
              onChange={(e) => setReport(e.target.value)}
              onBlur={() => void saveReport()}
              maxLength={10000}
              rows={4}
              placeholder={t("workReport.placeholder")}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
            />
          </>
        )}
      </section>

      <section className="mt-3 border-y border-border bg-surface px-4 py-3">
        <h2 className="mb-2 text-sm font-medium">{t("signoff.title")}</h2>
        <FieldSignOff wo={wo} enqueue={enqueue} />
      </section>

      <section className="mt-3 border-y border-border bg-surface px-4 py-3">
        <h2 className="mb-2 text-sm font-medium">{t("activity.title")}</h2>
        <ul className="mb-3 space-y-3">
          {wo.comments.map((c) => (
            <li key={c.id} className="text-sm">
              <div className="text-xs text-muted">
                <span className="font-medium text-foreground">{c.user}</span> · {format.dateTime(new Date(c.at), { dateStyle: "short", timeStyle: "short" })}
              </div>
              <p className="whitespace-pre-wrap">{c.body}</p>
            </li>
          ))}
          {wo.comments.length === 0 && <li className="text-sm text-muted">—</li>}
        </ul>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <MentionTextarea value={comment} onValueChange={setComment} members={members} placeholder={t("activity.placeholder")} rows={2} className="min-h-12" />
          </div>
          <Button
            aria-label={t("activity.send")}
            disabled={!comment.trim()}
            onClick={async () => {
              await enqueue({ kind: "comment", woId: wo.id, body: comment.trim() });
              setComment("");
            }}
          >
            <Send className="size-4" />
          </Button>
        </div>
      </section>
      <RequestChat key={wo.id} workOrderId={wo.id} className="mt-3 border-y border-border bg-surface px-4 py-3 text-sm" />
    </main>
  );
}

/**
 * Client sign-off on the device: a name and a signature (queued like a photo, uploaded when online),
 * or "client absent", which removes the need for a signature.
 */
function FieldSignOff({ wo, enqueue }: { wo: OfflineWorkOrder; enqueue: Enqueue }) {
  const t = useTranslations();
  const format = useFormatter();
  const pad = useRef<SignaturePadHandle>(null);
  const [name, setName] = useState("");
  const [empty, setEmpty] = useState(true);
  const [saving, setSaving] = useState(false);

  if (wo.signOff) {
    return (
      <p className="text-sm">
        {t("field.signedBy", { name: wo.signOff.name })}
        <span className="block text-xs text-muted">
          {format.dateTime(new Date(wo.signOff.at), { dateStyle: "short", timeStyle: "short" })}
          {wo.signOff.pending && ` · ${t("field.waitingUpload")}`}
        </span>
      </p>
    );
  }
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={wo.clientAbsent}
          onChange={(e) => void enqueue({ kind: "clientAbsent", woId: wo.id, absent: e.target.checked })}
          className="size-5 accent-brand"
        />
        {t("signoff.clientAbsent")}
      </label>
      {wo.clientAbsent ? (
        <p className="text-sm text-muted">{t("signoff.absentNote")}</p>
      ) : (
        <>
          <p className="text-xs text-muted">{t("signoff.hint")}</p>
          <SignaturePad ref={pad} onChange={setEmpty} />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("signoff.namePlaceholder")}
            className="h-11 w-full rounded-md border border-border bg-surface px-3 text-sm"
          />
          <div className="flex gap-2">
            <Button
              className="h-11 flex-1"
              disabled={empty || !name.trim() || saving}
              onClick={async () => {
                setSaving(true);
                const blob = await pad.current?.toBlob();
                if (blob) await enqueue({ kind: "photo", woId: wo.id, itemId: null, blobKey: newId(), filename: "signature.png", signOffName: name.trim() }, blob);
                setSaving(false);
              }}
            >
              {t("signoff.confirm")}
            </Button>
            <Button variant="ghost" className="h-11" onClick={() => pad.current?.clear()}>
              {t("signoff.clear")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
