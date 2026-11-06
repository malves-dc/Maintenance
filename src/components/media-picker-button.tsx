"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Camera, Images, Video } from "lucide-react";
import { Button } from "@/components/ui";

const itemClass = "flex min-h-11 w-full items-center gap-2 whitespace-nowrap px-3 text-left text-sm hover:bg-gray-50";

/**
 * Button that picks photos or videos. With a mouse it opens the file dialog. On a touch screen it first offers
 * the camera or the gallery, because Android Chrome opens a media picker with no camera when `accept` lists only
 * images and videos, and `capture` is the only way to ask for the camera.
 */
export function MediaPickerButton({
  disabled,
  onFiles,
  children,
}: {
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  children: ReactNode;
}) {
  const t = useTranslations();
  const gallery = useRef<HTMLInputElement>(null);
  const photo = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = [...(e.target.files ?? [])];
    e.target.value = "";
    onFiles(list);
  };
  const choose = (input: HTMLInputElement | null) => {
    setOpen(false);
    input?.click();
  };

  return (
    <div ref={root} className="relative">
      <input ref={gallery} type="file" accept="image/*,video/*" multiple className="sr-only" onChange={pick} />
      <input ref={photo} type="file" accept="image/*" capture="environment" className="sr-only" onChange={pick} />
      <input ref={video} type="file" accept="video/*" capture="environment" className="sr-only" onChange={pick} />
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={disabled}
        aria-expanded={open}
        onClick={() => (window.matchMedia("(pointer: coarse)").matches ? setOpen(!open) : gallery.current?.click())}
      >
        {children}
      </Button>
      {open && (
        <div className="absolute bottom-full left-0 z-20 mb-1 overflow-hidden rounded-md border border-border bg-surface py-1 shadow-lg">
          <button type="button" className={itemClass} onClick={() => choose(photo.current)}>
            <Camera className="size-4" />
            {t("field.takePhoto")}
          </button>
          <button type="button" className={itemClass} onClick={() => choose(video.current)}>
            <Video className="size-4" />
            {t("field.takeVideo")}
          </button>
          <button type="button" className={itemClass} onClick={() => choose(gallery.current)}>
            <Images className="size-4" />
            {t("activity.fromGallery")}
          </button>
        </div>
      )}
    </div>
  );
}
