"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { FileDown, ImagePlus, MapPin, Monitor, Pencil, Play, Send, Square, Trash2, X } from "lucide-react";
import { ActionForm, FieldError } from "@/components/action-form";
import { Button, Field, Input } from "@/components/ui";
import { MediaPickerButton } from "@/components/media-picker-button";
import { MentionTextarea, type MentionMember } from "@/components/mention-textarea";
import { SignaturePad, type SignaturePadHandle } from "@/components/signature-pad";
import { uploadFile, type Uploaded } from "@/lib/upload-client";
import { useUploader } from "@/lib/use-uploader";
import { AttachmentThumb } from "@/components/attachment-thumb";
import { DateInput } from "@/components/date-input";
import { cn } from "@/lib/utils";
import type { WorkMode } from "@/generated/prisma/enums";
import {
  addCommentAction,
  addCostAction,
  addTimeAction,
  clearSignOffAction,
  deleteAttachmentAction,
  deleteCostAction,
  deleteTimeAction,
  deleteWorkOrderAction,
  setClientAbsentAction,
  setTimeModeAction,
  signOffAction,
  startTimerAction,
  stopTimerAction,
} from "../actions";

function formatDuration(totalMinutes: number) {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

// ── Time

export type TimeRow = { id: string; user: string; mine: boolean; minutes: number | null; startedAt: string; label: string; note: string | null; mode: WorkMode };

const MODE_ICON = { ONSITE: MapPin, REMOTE: Monitor } as const;

/** On site / remote, as a two-button switch. */
function ModeSwitch({ value, onChange }: { value: WorkMode; onChange: (m: WorkMode) => void }) {
  const t = useTranslations();
  return (
    <div role="radiogroup" aria-label={t("time.mode")} className="inline-flex rounded-md border border-border p-0.5 text-sm">
      {(["ONSITE", "REMOTE"] as const).map((m) => {
        const Icon = MODE_ICON[m];
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={value === m}
            onClick={() => onChange(m)}
            className={cn("inline-flex items-center gap-1.5 rounded px-2.5 py-1", value === m ? "bg-brand text-white" : "text-muted hover:text-foreground")}
          >
            <Icon className="size-3.5" />
            {t(`time.modes.${m}`)}
          </button>
        );
      })}
    </div>
  );
}

export function TimeTracker({
  woId,
  entries,
  runningSince,
  runningMode,
  defaultMode,
  canExecute,
  canDeleteAny,
  billed,
}: {
  woId: string;
  entries: TimeRow[];
  runningSince: string | null; // my running timer
  runningMode: WorkMode | null;
  /** Where a new entry is worked unless changed: my last entry's mode on this work order. */
  defaultMode: WorkMode;
  canExecute: boolean;
  canDeleteAny: boolean;
  /** Time billed per technician (rounded up to the billing period); null when the company doesn't round. */
  billed: { block: number; total: number; people: { name: string; minutes: number; billed: number }[] } | null;
}) {
  const t = useTranslations();
  const [pending, start] = useTransition();
  const [now, setNow] = useState(() => Date.now());
  const [manual, setManual] = useState(false);
  const [mode, setMode] = useState<WorkMode>(defaultMode);
  const other = (m: WorkMode): WorkMode => (m === "ONSITE" ? "REMOTE" : "ONSITE");

  useEffect(() => {
    if (!runningSince) return;
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, [runningSince]);

  const total = entries.reduce((s, e) => s + (e.minutes ?? 0), 0);
  const elapsed = runningSince ? Math.max(0, Math.floor((now - new Date(runningSince).getTime()) / 1000)) : 0;
  const clock = `${Math.floor(elapsed / 3600)}:${String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-3">
      {canExecute && !runningSince && <ModeSwitch value={mode} onChange={setMode} />}
      {canExecute && (
        <div className="flex items-center gap-2">
          {runningSince ? (
            <Button variant="danger" disabled={pending} onClick={() => start(() => stopTimerAction(woId))} className="flex-1">
              <Square className="size-4" />
              {t("time.stop")} <span className="font-mono tabular-nums">{clock}</span>
              {runningMode && <span className="text-xs font-normal opacity-90">· {t(`time.modes.${runningMode}`)}</span>}
            </Button>
          ) : (
            <Button disabled={pending} onClick={() => start(() => startTimerAction(woId, mode))} className="flex-1">
              <Play className="size-4" />
              {t("time.start")}
            </Button>
          )}
          <Button variant="secondary" onClick={() => setManual((v) => !v)}>
            {t("time.addManual")}
          </Button>
        </div>
      )}
      {manual && (
        <ActionForm action={addTimeAction.bind(null, woId)} submitLabel={t("common.add")} className="rounded-md border border-border p-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label={t("time.date")}>
              <DateInput name="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
            </Field>
            <Field label={t("time.minutes")}>
              <Input name="minutes" type="number" min={1} max={1440} required />
              <FieldError name="minutes" />
            </Field>
          </div>
          <Input name="note" placeholder={t("time.notePlaceholder")} />
          <input type="hidden" name="mode" value={mode} />
          {runningSince && <ModeSwitch value={mode} onChange={setMode} />}
        </ActionForm>
      )}
      {entries.length > 0 && (
        <ul className="divide-y divide-border text-sm">
          {entries.map((e) => {
            const Icon = MODE_ICON[e.mode];
            const canChange = canExecute && (e.mine || canDeleteAny);
            const badge = (
              <>
                <Icon className="size-3" />
                {t(`time.modes.${e.mode}`)}
              </>
            );
            return (
            <li key={e.id} className="flex items-center justify-between gap-2 py-1.5">
              <span className="min-w-0">
                <span className="font-medium">{e.user}</span>
                <span className="ml-1.5 text-xs text-muted">{e.label}</span>
                {canChange ? (
                  <button
                    type="button"
                    disabled={pending}
                    title={t("time.switchTo", { mode: t(`time.modes.${other(e.mode)}`) })}
                    onClick={() => start(() => setTimeModeAction(woId, e.id, other(e.mode)))}
                    className="ml-1.5 inline-flex items-center gap-1 rounded border border-border px-1.5 text-xs text-muted hover:border-brand hover:text-brand"
                  >
                    {badge}
                  </button>
                ) : (
                  <span className="ml-1.5 inline-flex items-center gap-1 text-xs text-muted">{badge}</span>
                )}
                {e.note && <span className="block truncate text-xs text-muted">{e.note}</span>}
              </span>
              <span className="flex items-center gap-1">
                <span className="tabular-nums">{e.minutes == null ? t("time.running") : formatDuration(e.minutes)}</span>
                {canExecute && (e.mine || canDeleteAny) && e.minutes != null && (
                  <button
                    className="rounded p-1 text-muted hover:text-danger"
                    title={t("common.delete")}
                    onClick={() => confirm(`${t("common.delete")}?`) && start(() => deleteTimeAction(woId, e.id))}
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </span>
            </li>
            );
          })}
          <li className="flex justify-between py-1.5 font-medium">
            <span>{t("time.total")}</span>
            <span className="tabular-nums">{formatDuration(total)}</span>
          </li>
          {billed && billed.total > 0 && (
            <li className="py-1.5">
              <div className="flex justify-between font-medium">
                <span title={t("time.billedHint", { block: billed.block })}>{t("time.billed")}</span>
                <span className="tabular-nums">{formatDuration(billed.total)}</span>
              </div>
              {billed.people.length > 0 && (
                <ul className="mt-0.5 space-y-0.5 text-xs text-muted">
                  {billed.people.map((p) => (
                    <li key={p.name} className="flex justify-between">
                      <span>{p.name}</span>
                      <span className="tabular-nums">{t("time.billedFrom", { billed: formatDuration(p.billed), logged: formatDuration(p.minutes) })}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

// ── Costs

export function CostsPanel({
  woId,
  costs,
  summary,
  canExecute,
}: {
  woId: string;
  costs: { id: string; description: string; amount: string }[];
  summary: { labor: string; parts: string | null; other: string; total: string; urgent: { amount: string; rule: string } | null; travel: { amount: string; trips: number; rule: string } | null };
  canExecute: boolean;
}) {
  const t = useTranslations();
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);
  return (
    <div className="space-y-2 text-sm">
      <div className="flex justify-between">
        <span className="text-muted">{t("costs.labor")}</span>
        <span className="tabular-nums">{summary.labor}</span>
      </div>
      {summary.parts && (
        <div className="flex justify-between">
          <span className="text-muted">{t("costs.parts")}</span>
          <span className="tabular-nums">{summary.parts}</span>
        </div>
      )}
      {summary.urgent && (
        <div className="flex justify-between gap-2">
          <span className="text-muted">
            {t("costs.urgent")} <span className="text-xs">({summary.urgent.rule})</span>
          </span>
          <span className="tabular-nums">{summary.urgent.amount}</span>
        </div>
      )}
      {summary.travel && (
        <div className="flex justify-between gap-2">
          <span className="text-muted">
            {t("costs.trips", { count: summary.travel.trips })} <span className="text-xs">({summary.travel.rule})</span>
          </span>
          <span className="tabular-nums">{summary.travel.amount}</span>
        </div>
      )}
      {costs.map((c) => (
        <div key={c.id} className="flex items-center justify-between gap-2">
          <span className="truncate text-muted">{c.description}</span>
          <span className="flex items-center gap-1 tabular-nums">
            {c.amount}
            {canExecute && (
              <button className="rounded p-0.5 text-muted hover:text-danger" disabled={pending} onClick={() => start(() => deleteCostAction(woId, c.id))}>
                <X className="size-3.5" />
              </button>
            )}
          </span>
        </div>
      ))}
      <div className="flex justify-between border-t border-border pt-2 font-medium">
        <span>{t("costs.total")}</span>
        <span className="tabular-nums">{summary.total}</span>
      </div>
      {canExecute &&
        (adding ? (
          <ActionForm action={addCostAction.bind(null, woId)} submitLabel={t("common.add")} className="rounded-md border border-border p-3">
            <Input name="description" placeholder={t("costs.descriptionPlaceholder")} required />
            <Input name="amount" inputMode="decimal" placeholder="0.00" required />
            <FieldError name="amount" />
          </ActionForm>
        ) : (
          <button className="text-xs font-medium text-brand" onClick={() => setAdding(true)}>
            + {t("costs.add")}
          </button>
        ))}
    </div>
  );
}

// ── Attachments gallery

export type Photo = { id: string; url: string; filename: string; mimeType: string; mine: boolean };

export function Gallery({ woId, files, canExecute, canDeleteAny }: { woId: string; files: Photo[]; canExecute: boolean; canDeleteAny: boolean }) {
  const t = useTranslations();
  const input = useRef<HTMLInputElement>(null);
  const uploader = useUploader();
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <div>
      {files.length > 0 && (
        <div className="mb-3 grid grid-cols-3 gap-2">
          {files.map((f) => (
            <div key={f.id} className="group relative">
              <a href={f.url} target="_blank" rel="noreferrer" title={f.filename}>
                <AttachmentThumb url={f.url} filename={f.filename} mimeType={f.mimeType} />
              </a>
              {canExecute && (f.mine || canDeleteAny) && (
                <button
                  className="absolute right-1 top-1 rounded bg-white/90 p-1 text-muted shadow sm:opacity-0 sm:group-hover:opacity-100"
                  disabled={pending}
                  title={t("common.delete")}
                  onClick={() => confirm(`${t("common.delete")}?`) && start(() => deleteAttachmentAction(woId, f.id))}
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {canExecute && (
        <>
          <input
            ref={input}
            type="file"
            multiple
            accept="image/*,video/*,application/pdf"
            className="sr-only"
            onChange={async (e) => {
              const list = [...(e.target.files ?? [])];
              e.target.value = "";
              await uploader.upload(list, { workOrderId: woId });
              router.refresh();
            }}
          />
          <Button size="sm" variant="secondary" disabled={uploader.busy} onClick={() => input.current?.click()}>
            <ImagePlus className="size-4" />
            {uploader.busy ? uploader.label : t("files.addMedia")}
          </Button>
          {uploader.error && <p className="mt-2 text-xs text-danger">{uploader.error}</p>}
        </>
      )}
    </div>
  );
}

// ── Comment composer

export function CommentBox({ woId, members }: { woId: string; members: MentionMember[] }) {
  const t = useTranslations();
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<Uploaded[]>([]);
  const uploader = useUploader();
  const [pending, start] = useTransition();

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          await addCommentAction(woId, body, files.map((f) => f.id));
          setBody("");
          setFiles([]);
        });
      }}
    >
      <MentionTextarea value={body} onValueChange={setBody} members={members} placeholder={t("activity.placeholder")} className="min-h-20" />
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((f) => (
            <AttachmentThumb key={f.id} url={f.url} filename={f.filename} mimeType={f.mimeType} className="size-14" />
          ))}
        </div>
      )}
      {uploader.error && <p className="text-xs text-danger">{uploader.error}</p>}
      <div className="flex justify-between">
        <MediaPickerButton
          disabled={uploader.busy}
          onFiles={async (list) => {
            const ups = await uploader.upload(list, { workOrderId: woId });
            setFiles((prev) => [...prev, ...ups]);
          }}
        >
          <ImagePlus className="size-4" />
          {uploader.busy ? uploader.label : t("activity.attach")}
        </MediaPickerButton>
        <Button size="sm" disabled={pending || uploader.busy || (!body.trim() && files.length === 0)}>
          <Send className="size-4" />
          {t("activity.send")}
        </Button>
      </div>
    </form>
  );
}

// ── Client sign-off

export function SignOff({
  woId,
  signed,
  clientAbsent,
  canExecute: canExecuteRaw,
  done,
}: {
  woId: string;
  signed: { name: string; at: string; url: string } | null;
  clientAbsent: boolean;
  canExecute: boolean;
  /** Completed jobs keep their sign-off (it is required to complete); reopen to change it. */
  done: boolean;
}) {
  const canExecute = canExecuteRaw && !done;
  const t = useTranslations("signoff");
  const pad = useRef<SignaturePadHandle>(null);
  const [name, setName] = useState("");
  const [empty, setEmpty] = useState(true);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  // "Client absent" replaces the signature; offered until the client has signed.
  const absentBox = !signed && canExecute && (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={clientAbsent}
        disabled={pending}
        onChange={(e) => {
          const absent = e.target.checked;
          start(() => setClientAbsentAction(woId, absent));
        }}
        className="size-4 accent-brand"
      />
      {t("clientAbsent")}
    </label>
  );
  if (!signed && clientAbsent) {
    return (
      <div className="space-y-2">
        {absentBox}
        <p className="text-sm text-muted">{t("absentNote")}</p>
      </div>
    );
  }

  if (signed) {
    return (
      <div className="space-y-2 text-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={signed.url} alt={t("signature")} className="h-24 w-full rounded-md border border-border bg-white object-contain" />
        <div>
          <span className="font-medium">{signed.name}</span>
          <span className="block text-xs text-muted">{signed.at}</span>
        </div>
        {canExecute && (
          <button className="text-xs text-muted hover:text-danger" disabled={pending} onClick={() => confirm(t("clearConfirm")) && start(() => clearSignOffAction(woId))}>
            {t("clear")}
          </button>
        )}
      </div>
    );
  }
  if (!canExecute) return <p className="text-sm text-muted">{t("notSigned")}</p>;
  if (!open) {
    return (
      <div className="space-y-3">
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          <Pencil className="size-4" />
          {t("collect")}
        </Button>
        {absentBox}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {absentBox}
      <p className="text-xs text-muted">{t("hint")}</p>
      <SignaturePad ref={pad} onChange={setEmpty} />
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("namePlaceholder")} />
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={empty || !name.trim() || pending}
          onClick={() =>
            start(async () => {
              const blob = await pad.current!.toBlob();
              if (!blob) return;
              const up = await uploadFile(blob, { workOrderId: woId }, "signature.png");
              await signOffAction(woId, name, up.id);
            })
          }
        >
          {t("confirm")}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => pad.current?.clear()}>
          {t("clear")}
        </Button>
      </div>
    </div>
  );
}

// ── Header actions

export function WorkOrderActions({ woId, canEdit, canDelete }: { woId: string; canEdit: boolean; canDelete: boolean }) {
  const t = useTranslations();
  const [pending, start] = useTransition();
  return (
    <>
      <Link href={`/report/${woId}`} prefetch={false}>
        <Button variant="secondary">
          <FileDown className="size-4" />
          {t("wo.report")}
        </Button>
      </Link>
      {canEdit && (
        <Link href={`/work-orders/${woId}/edit`}>
          <Button variant="secondary">
            <Pencil className="size-4" />
            {t("common.edit")}
          </Button>
        </Link>
      )}
      {canDelete && (
        <Button variant="danger" disabled={pending} onClick={() => confirm(t("wo.deleteConfirm")) && start(() => deleteWorkOrderAction(woId))}>
          <Trash2 className="size-4" />
        </Button>
      )}
    </>
  );
}
