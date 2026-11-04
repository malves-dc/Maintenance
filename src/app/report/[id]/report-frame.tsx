"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { FileText } from "lucide-react";

const noop = () => () => {};
// `false` on browsers that can't show a PDF in the page (Chrome on Android): a framed PDF stays blank there.
// Older browsers without the property are assumed to have a viewer.
const canShowPdf = () => navigator.pdfViewerEnabled !== false;

/** The PDF framed when the browser has a PDF viewer; otherwise a button that hands it to the device's PDF app. */
export function ReportFrame({ src, title }: { src: string; title: string }) {
  const t = useTranslations("report");
  const viewer = useSyncExternalStore(noop, canShowPdf, () => null);
  if (viewer === null) return null;
  if (viewer) return <iframe src={src} title={title} className="size-full border-0" />;
  return (
    <div className="flex size-full flex-col items-center justify-center gap-4 p-6 text-center">
      <FileText className="size-12 text-gray-400" />
      <p className="max-w-xs text-sm text-gray-600">{t("noViewer")}</p>
      <a
        href={src}
        download
        className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground shadow-sm hover:shadow-md"
      >
        {t("openPdf")}
      </a>
    </div>
  );
}
