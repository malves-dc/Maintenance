"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Field, FormError, Input } from "@/components/ui";
import { useActionForm } from "@/lib/use-action-form";
import { confirmTwoFactorAction, disableTwoFactorAction, newRecoveryCodesAction, type TwoFactorState } from "./actions";

const errorText = (t: ReturnType<typeof useTranslations>, s: TwoFactorState) => (s?.error ? (t.has(s.error) ? t(s.error) : t("invalidCode")) : null);

/** The QR code and key to add to the app, then the first code to confirm it; then the recovery codes, once. */
export function TwoFactorSetup({ qr, secret }: { qr: string; secret: string }) {
  const t = useTranslations("twoFactor");
  const router = useRouter();
  const [state, action, pending] = useActionForm(confirmTwoFactorAction);
  if (state?.codes) return <RecoveryCodes codes={state.codes} onDone={() => router.push("/dashboard")} />;
  return (
    <form onSubmit={action} className="space-y-4">
      <p className="text-sm">{t("step1")}</p>
      {/* qrcode's own SVG, made on the server from the otpauth link. */}
      <div className="mx-auto w-48 rounded-md bg-white p-2" dangerouslySetInnerHTML={{ __html: qr }} />
      <p className="text-xs text-muted">
        {t("manualKey")} <code className="select-all break-all font-mono text-foreground">{secret.replace(/(.{4})/g, "$1 ").trim()}</code>
      </p>
      <Field label={t("step2")}>
        <Input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required autoFocus />
      </Field>
      <FormError message={errorText(t, state)} />
      <Button className="w-full" disabled={pending}>
        {t("confirm")}
      </Button>
    </form>
  );
}

function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone?: () => void }) {
  const t = useTranslations("twoFactor");
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-3">
      <h2 className="font-medium">{t("recoveryTitle")}</h2>
      <p className="text-sm text-muted">{t("recoveryIntro")}</p>
      <ul className="grid grid-cols-2 gap-2 rounded-md border border-border p-3 font-mono text-sm">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => navigator.clipboard.writeText(codes.join("\n")).then(() => setCopied(true), () => undefined)}
        >
          {copied ? t("copied") : t("copy")}
        </Button>
        {onDone && (
          <Button type="button" onClick={onDone}>
            {t("done")}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Profile: new recovery codes, or turn it off (when the company doesn't require it). Both ask for a current code. */
export function TwoFactorManage({ canTurnOff }: { canTurnOff: boolean }) {
  const t = useTranslations("twoFactor");
  const [codesState, codesAction, codesPending] = useActionForm(newRecoveryCodesAction);
  const [offState, offAction, offPending] = useActionForm(disableTwoFactorAction);
  if (codesState?.codes) return <RecoveryCodes codes={codesState.codes} />;
  return (
    <form
      onSubmit={(e) => {
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        if (submitter?.value === "off") {
          if (!confirm(t("turnOffConfirm"))) return e.preventDefault();
          return offAction(e);
        }
        if (!confirm(t("newCodesConfirm"))) return e.preventDefault();
        return codesAction(e);
      }}
      className="space-y-3"
    >
      <Field label={t("codeOrRecovery")}>
        <Input name="code" autoComplete="one-time-code" maxLength={20} required className="w-48" />
      </Field>
      <FormError message={errorText(t, codesState) ?? errorText(t, offState)} />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" name="do" value="codes" disabled={codesPending || offPending}>
          {t("newCodes")}
        </Button>
        {canTurnOff && (
          <Button size="sm" variant="danger" name="do" value="off" disabled={codesPending || offPending}>
            {t("turnOff")}
          </Button>
        )}
      </div>
    </form>
  );
}
