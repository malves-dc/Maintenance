"use client";

import { useState, useTransition } from "react";
import { useActionForm } from "@/lib/use-action-form";
import { useTranslations } from "next-intl";
import { Button, Field, FormError, Input, Select } from "@/components/ui";
import { eraseMemberAction, inviteUserAction, resetTwoFactorAction, revokeInviteAction, updateMemberAction } from "../actions";

/** The company's roles, by name: built-in ones (value = the role) and created ones (value "job:<id>") alike. Labels come from the server. */
export type RoleOptions = { value: string; label: string }[];

function RoleSelectOptions({ options }: { options: RoleOptions }) {
  return (
    <>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </>
  );
}

/** Staff invites pick a role; without `roleOptions` it invites a client (portal) user of one of `clients`. */
export function InviteForm({ clients = [], roleOptions }: { clients?: { id: string; name: string }[]; roleOptions?: RoleOptions }) {
  const t = useTranslations();
  const [state, action, pending] = useActionForm(inviteUserAction);
  const [role, setRole] = useState(roleOptions ? "TECHNICIAN" : "REQUESTER");
  const [copied, setCopied] = useState(false);
  const fullUrl = state?.inviteUrl && typeof window !== "undefined" ? window.location.origin + state.inviteUrl : null;

  return (
    <div className="space-y-4">
      <form onSubmit={action} className="grid gap-3 sm:grid-cols-[1fr_200px_auto] sm:items-end">
        <Field label={t("common.email")}>
          <Input name="email" type="email" required />
        </Field>
        {roleOptions ? (
          <Field label={t("common.role")}>
            <Select name="role" value={role} onChange={(e) => setRole(e.target.value)}>
              <RoleSelectOptions options={roleOptions} />
            </Select>
          </Field>
        ) : (
          <>
            <input type="hidden" name="role" value="REQUESTER" />
            <Field label={t("settings.client")}>
              <Select name="clientId" required>
                <option value="">—</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        )}
        <Button disabled={pending}>{t("settings.inviteSend")}</Button>
        {roleOptions && role === "REQUESTER" && (
          <div className="sm:col-span-3">
            <Field label={t("settings.client")} hint={t("settings.clientHint")}>
              <Select name="clientId" required>
                <option value="">—</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}
      </form>
      <FormError message={state?.error ? t("common.somethingWrong") : null} />
      {fullUrl && (
        <div className="rounded-md border border-border bg-gray-50 p-3 text-sm">
          <p className="mb-2 text-muted">{t("settings.inviteLink", { email: state?.inviteEmail ?? "" })}</p>
          <div className="flex gap-2">
            <Input readOnly value={fullUrl} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
            <Button
              type="button"
              variant="secondary"
              onClick={async () => {
                await navigator.clipboard.writeText(fullUrl);
                setCopied(true);
              }}
            >
              {copied ? t("common.copied") : t("common.copy")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Role (staff only: without `roleOptions` there is no role picker), deactivate / reactivate, reset two-factor and erase. */
export function MemberControls({ id, role, active, twoFactor, roleOptions }: { id: string; role?: string; active: boolean; twoFactor?: boolean; roleOptions?: RoleOptions }) {
  const t = useTranslations();
  const [pending, start] = useTransition();
  return (
    <div className="inline-flex items-center gap-2">
      {/* Always there, so admins know where to find it; greyed out until the person has two-factor on. */}
      <Button
        size="sm"
        variant="ghost"
        disabled={pending || !twoFactor}
        title={twoFactor ? undefined : t("twoFactor.resetUnavailable")}
        onClick={() => confirm(t("twoFactor.resetConfirm")) && start(() => resetTwoFactorAction(id))}
      >
        {t("twoFactor.reset")}
      </Button>
      {roleOptions && (
        <Select
          className="h-8 w-44"
          defaultValue={role}
          disabled={pending}
          onChange={(e) => start(() => updateMemberAction(id, { role: e.target.value }))}
        >
          <RoleSelectOptions options={roleOptions} />
        </Select>
      )}
      <Button
        size="sm"
        variant={active ? "danger" : "secondary"}
        disabled={pending}
        onClick={() => start(() => updateMemberAction(id, { active: !active }))}
      >
        {active ? t("settings.deactivate") : t("settings.reactivate")}
      </Button>
      {!active && (
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          title={t("erasure.eraseHint")}
          onClick={() =>
            confirm(t("erasure.eraseConfirm")) &&
            start(async () => {
              const r = await eraseMemberAction(id);
              if (r.error) alert(t.has(r.error) ? t(r.error) : t("common.somethingWrong"));
              else if (r.scope === "company") alert(t("erasure.erasedHere"));
            })
          }
        >
          {t("erasure.erase")}
        </Button>
      )}
    </div>
  );
}

export function RevokeInviteButton({ id }: { id: string }) {
  const t = useTranslations();
  const [pending, start] = useTransition();
  return (
    <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(() => revokeInviteAction(id))}>
      {t("settings.revoke")}
    </Button>
  );
}
