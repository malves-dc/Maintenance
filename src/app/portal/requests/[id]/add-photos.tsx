"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PhotoPicker } from "@/components/photo-picker";
import { Button, FormError } from "@/components/ui";
import { useActionForm } from "@/lib/use-action-form";
import type { FormResult } from "@/lib/forms";
import { addRequestPhotosAction } from "../../actions";

/** Lets the client add photos to a request already sent, whatever its stage. `max` = how many fit in this go. */
export function AddRequestPhotos({ requestId, max }: { requestId: string; max: number }) {
  const t = useTranslations();
  const [photos, setPhotos] = useState<File[]>([]);
  // A new picker (empty) after each successful upload.
  const [round, setRound] = useState(0);
  const [state, onSubmit, pending] = useActionForm(async (prev: FormResult, form: FormData) => {
    for (const p of photos) form.append("photos", p);
    const r = await addRequestPhotosAction(requestId, prev, form);
    if (r?.ok) {
      setPhotos([]);
      setRound((n) => n + 1);
    }
    return r;
  });
  const error = state?.error ? (t.has(state.error as never) ? t(state.error as never) : t("common.somethingWrong")) : null;

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-3 border-t border-border pt-4">
      <div>
        <div className="text-sm font-medium">{t("portal.addPhotosTitle")}</div>
        <p className="text-xs text-muted">{t("portal.addPhotosHint")}</p>
      </div>
      <PhotoPicker key={round} max={max} onChange={setPhotos} />
      <FormError message={error} />
      {state?.ok && photos.length === 0 && <p className="text-sm text-green-700">{t("portal.photosAdded")}</p>}
      {photos.length > 0 && (
        <Button size="sm" disabled={pending}>
          {pending ? t("portal.sending") : t("portal.addPhotosSend", { count: photos.length })}
        </Button>
      )}
    </form>
  );
}
