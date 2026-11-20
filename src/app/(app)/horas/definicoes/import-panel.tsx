"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, FormError } from "@/components/ui";

type Result = {
  matchedUsers: number;
  missingUsers: { name: string; email: string | null; entries: number }[];
  matchedObras: number;
  missingObras: { code: string; name: string; entries: number }[];
  importable: number;
  skippedUnmatched: number;
  duplicates: number;
  invalid: number;
  created: number;
};

/** Import from the old DC Horas app: check the file first, then import (identical entries are skipped). */
export function ImportPanel() {
  const t = useTranslations("hours.import");
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(apply: boolean) {
    const file = input.current?.files?.[0];
    if (!file) return setError(t("errors.noFile"));
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("file", file);
      if (apply) body.set("apply", "1");
      const res = await fetch("/api/horas/import", { method: "POST", body });
      const json = await res.json().catch(() => ({ error: "badFile" }));
      if (!res.ok) {
        setResult(null);
        setError(t.has(`errors.${json.error}` as never) ? t(`errors.${json.error}` as never) : t("errors.badFile"));
      } else {
        setResult(json);
        if (apply) router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted">{t("intro")}</p>
      <input ref={input} type="file" accept="application/json,.json" onChange={() => setResult(null)} className="block w-full text-sm" />
      <FormError message={error} />
      {result && (
        <div className="space-y-2 rounded-md bg-gray-50 p-3">
          {result.created > 0 && <p className="font-medium text-green-700">{t("created", { n: result.created })}</p>}
          <ul className="list-disc space-y-0.5 pl-5">
            <li>{t("people", { n: result.matchedUsers })}</li>
            <li>{t("obras", { n: result.matchedObras })}</li>
            {!result.created && <li className="font-medium">{t("importable", { n: result.importable })}</li>}
            {result.duplicates > 0 && <li>{t("duplicates", { n: result.duplicates })}</li>}
            {result.skippedUnmatched > 0 && <li className="text-amber-700">{t("skipped", { n: result.skippedUnmatched })}</li>}
            {result.invalid > 0 && <li className="text-amber-700">{t("invalid", { n: result.invalid })}</li>}
          </ul>
          {result.missingUsers.length > 0 && (
            <div>
              <p className="font-medium">{t("missingUsers")}</p>
              <ul className="pl-5 text-muted">
                {result.missingUsers.map((u, i) => (
                  <li key={i}>
                    {u.name} {u.email ? `<${u.email}>` : ""} · {t("entries", { n: u.entries })}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.missingObras.length > 0 && (
            <div>
              <p className="font-medium">{t("missingObras")}</p>
              <ul className="pl-5 text-muted">
                {result.missingObras.map((o, i) => (
                  <li key={i}>
                    {o.code} · {o.name} · {t("entries", { n: o.entries })}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      <div className="flex gap-2">
        <Button type="button" variant="secondary" disabled={busy} onClick={() => send(false)}>
          {t("check")}
        </Button>
        {result && !result.created && result.importable > 0 && (
          <Button type="button" disabled={busy} onClick={() => confirm(t("confirm", { n: result.importable })) && send(true)}>
            {t("apply", { n: result.importable })}
          </Button>
        )}
      </div>
    </div>
  );
}
