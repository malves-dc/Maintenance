"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ActionForm, FieldError } from "@/components/action-form";
import { DateInput, TimeInput } from "@/components/date-input";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { durationText, formatMinutes, parseDuration } from "@/lib/timesheet-rules";
import { saveEntryAction } from "./actions";
import { VillaSelect, type VillaOption } from "./villa-select";

export type EntryDefaults = {
  userId: string;
  villaId: string | null;
  date: string;
  startTime: string | null;
  endTime: string | null;
  minutes: number | null;
  description: string;
};

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/**
 * Hours at a villa: start and end times (with an optional break), or just how long. Managers can log for someone else.
 */
export function EntryForm({
  entryId,
  defaults,
  villas,
  people,
  next,
}: {
  entryId: string | null;
  defaults: EntryDefaults;
  villas: { recent: VillaOption[]; all: VillaOption[] };
  people: { id: string; name: string }[] | null;
  next: string;
}) {
  const t = useTranslations("hours");
  const [byTimes, setByTimes] = useState((!!defaults.startTime && !!defaults.endTime) || defaults.minutes === null);
  const [start, setStart] = useState(defaults.startTime ?? "");
  const [end, setEnd] = useState(defaults.endTime ?? "");
  const [pause, setPause] = useState("");
  const [duration, setDuration] = useState(defaults.minutes !== null ? durationText(defaults.minutes) : "");

  const worked = byTimes
    ? start && end && toMin(end) > toMin(start)
      ? toMin(end) - toMin(start) - (Number(pause) || 0)
      : null
    : parseDuration(duration);

  return (
    <ActionForm action={saveEntryAction.bind(null, entryId)} submitLabel={t("save")}>
      <input type="hidden" name="next" value={next} />
      {people && (
        <Field label={t("person")}>
          <Select name="userId" defaultValue={defaults.userId}>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label={t("villa")}>
        <VillaSelect recent={villas.recent} all={villas.all} defaultValue={defaults.villaId} />
        <FieldError name="villaId" />
      </Field>
      <Field label={t("date")}>
        <DateInput name="date" defaultValue={defaults.date} required />
        <FieldError name="date" />
      </Field>

      <div className="flex gap-1 rounded-md bg-gray-100 p-1 text-sm" role="tablist">
        {[true, false].map((times) => (
          <button
            key={String(times)}
            type="button"
            role="tab"
            aria-selected={byTimes === times}
            onClick={() => setByTimes(times)}
            className={`flex-1 rounded px-3 py-1.5 font-medium ${byTimes === times ? "bg-surface shadow-sm" : "text-muted"}`}
          >
            {times ? t("byTimes") : t("byDuration")}
          </button>
        ))}
      </div>

      {byTimes ? (
        <div className="grid grid-cols-3 gap-3">
          <Field label={t("start")}>
            <TimeInput name="startTime" defaultValue={start} onChange={setStart} required />
          </Field>
          <Field label={t("end")}>
            <TimeInput name="endTime" defaultValue={end} onChange={setEnd} required />
          </Field>
          <Field label={t("breakMinutes")}>
            <Input name="breakMinutes" inputMode="numeric" value={pause} onChange={(e) => setPause(e.target.value.replace(/\D/g, ""))} placeholder="0" />
          </Field>
        </div>
      ) : (
        <Field label={t("duration")} hint={t("durationHint")}>
          <Input name="duration" value={duration} onChange={(e) => setDuration(e.target.value)} inputMode="decimal" placeholder="8:00" required />
          <FieldError name="duration" />
        </Field>
      )}
      <p className="text-sm text-muted">
        {t("total")}: <span className="font-semibold text-foreground">{worked && worked > 0 ? formatMinutes(worked) : "—"}</span>
      </p>

      <Field label={t("description")}>
        <Textarea name="description" defaultValue={defaults.description} required maxLength={4000} placeholder={t("whatDone")} />
        <FieldError name="description" />
      </Field>
    </ActionForm>
  );
}
