"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Field } from "@/components/ui";
import { DateInput, TimeInput } from "@/components/date-input";
import { clockInterval, formatDuration, localDay, localTime, type ClockError, type ClockInterval } from "@/lib/offline/manual-time";

export type ClockResult = ClockInterval | { error: ClockError };

/**
 * Date + clock-in + clock-out fields for logging time by hand, with the resulting duration under them. The times
 * are read in the browser's time zone and submitted as ISO instants in the hidden fields `startedAt` and `endedAt`
 * (only while they make a valid interval). Render it only after a click: the defaults use the device's clock.
 */
export function ClockTimeFields({ onChange }: { onChange?: (result: ClockResult) => void }) {
  const t = useTranslations("time");
  const [value, setValue] = useState(() => ({ day: localDay(new Date()), from: "", to: localTime(new Date()) }));
  const result = clockInterval(value.day, value.from, value.to);
  const set = (patch: Partial<typeof value>) => {
    const next = { ...value, ...patch };
    setValue(next);
    onChange?.(clockInterval(next.day, next.from, next.to));
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <Field label={t("date")}>
            <DateInput required defaultValue={value.day} onChange={(day) => set({ day })} />
          </Field>
        </div>
        <Field label={t("from")}>
          <TimeInput required defaultValue={value.from} onChange={(from) => set({ from })} />
        </Field>
        <Field label={t("to")}>
          <TimeInput required defaultValue={value.to} onChange={(to) => set({ to })} />
        </Field>
      </div>
      {"error" in result ? (
        result.error !== "incomplete" && <p className="text-xs text-danger">{t(`clockErrors.${result.error}`)}</p>
      ) : (
        <p className="text-xs text-muted">
          {t("duration", { duration: formatDuration(result.minutes) })}
          {result.overnight && ` · ${t("overnight")}`}
        </p>
      )}
      {!("error" in result) && (
        <>
          <input type="hidden" name="startedAt" value={result.startedAt.toISOString()} />
          <input type="hidden" name="endedAt" value={result.endedAt.toISOString()} />
        </>
      )}
    </div>
  );
}
