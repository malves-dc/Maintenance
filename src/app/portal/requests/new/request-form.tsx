"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { FieldError, FieldErrorsProvider } from "@/components/action-form";
import { AvailabilityFields } from "@/components/availability-fields";
import { PhotoPicker } from "@/components/photo-picker";
import { Button, Field, FormError, Select } from "@/components/ui";
import { CountedInput, CountedTextarea } from "@/components/counted-field";
import { REQUEST_DESCRIPTION_MAX, REQUEST_TITLE_MAX } from "@/lib/request-limits";
import { useActionForm } from "@/lib/use-action-form";
import { cn } from "@/lib/utils";
import { createPortalRequestAction } from "../../actions";

type Opt = { id: string; name: string; villaId: string };
const URGENCY = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export function PortalRequestForm({
  villas,
  areas,
  assets,
  defaults,
}: {
  villas: { id: string; name: string }[];
  areas: Opt[];
  assets: Opt[];
  defaults: { villaId?: string; assetId?: string };
}) {
  const t = useTranslations();
  const [villaId, setVillaId] = useState(defaults.villaId ?? (villas.length === 1 ? villas[0].id : ""));
  const [priority, setPriority] = useState<(typeof URGENCY)[number]>("MEDIUM");
  const [photos, setPhotos] = useState<File[]>([]);
  // Photos are appended to the submitted FormData here, since they live in state.
  const [state, onSubmit, pending] = useActionForm(async (prev: Awaited<ReturnType<typeof createPortalRequestAction>>, form: FormData) => {
    for (const p of photos) form.append("photos", p);
    return createPortalRequestAction(prev, form);
  });
  const villaAreas = useMemo(() => areas.filter((a) => a.villaId === villaId), [areas, villaId]);
  const villaAssets = useMemo(() => assets.filter((a) => a.villaId === villaId), [assets, villaId]);

  return (
    <FieldErrorsProvider errors={state?.fieldErrors}>
      <form onSubmit={onSubmit} className="space-y-5">
        <Field label={t("assets.villa")}>
          <Select name="villaId" value={villaId} onChange={(e) => setVillaId(e.target.value)} required>
            <option value="" disabled>
              —
            </option>
            {villas.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </Select>
          <FieldError name="villaId" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("portal.whereInHouse")}>
            <Select key={`a-${villaId}`} name="areaId" defaultValue="" disabled={!villaId}>
              <option value="">{t("portal.notSure")}</option>
              {villaAreas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("portal.whichEquipment")}>
            <Select key={`e-${villaId}`} name="assetId" defaultValue={defaults.villaId === villaId ? (defaults.assetId ?? "") : ""} disabled={!villaId}>
              <option value="">{t("portal.notSure")}</option>
              {villaAssets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label={t("portal.whatsWrong")}>
          <CountedInput name="title" required max={REQUEST_TITLE_MAX} placeholder={t("portal.titlePlaceholder")} />
          <FieldError name="title" />
        </Field>
        <Field label={t("portal.details")}>
          <CountedTextarea name="description" max={REQUEST_DESCRIPTION_MAX} placeholder={t("portal.detailsPlaceholder")} />
          <FieldError name="description" />
        </Field>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">{t("portal.urgency")}</legend>
          <input type="hidden" name="priority" value={priority} />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {URGENCY.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={cn(
                  "rounded-md border px-3 py-2 text-left text-sm",
                  priority === p ? (p === "URGENT" ? "border-red-400 bg-red-50 text-red-800" : "border-brand bg-brand/10 text-brand") : "border-border",
                )}
              >
                <span className="block font-medium">{t(`portal.urgencyLevels.${p}.label`)}</span>
                <span className="block text-xs opacity-70">{t(`portal.urgencyLevels.${p}.hint`)}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <AvailabilityFields />
        <div>
          <div className="mb-1.5 text-sm font-medium">{t("portal.photos")}</div>
          <PhotoPicker onChange={setPhotos} />
        </div>
        <FormError message={state?.error ? (state.error === "validation" ? t("common.checkFields") : t("common.somethingWrong")) : null} />
        <Button className="w-full sm:w-auto" disabled={pending}>
          {pending ? t("portal.sending") : t("portal.send")}
        </Button>
      </form>
    </FieldErrorsProvider>
  );
}
