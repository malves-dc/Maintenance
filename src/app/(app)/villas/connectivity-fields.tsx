"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { FieldError } from "@/components/action-form";
import { Field, Input, Select } from "@/components/ui";
import type { ConnectivityType } from "@/generated/prisma/enums";

/** Villa form: how the server checks that the villa's internet is up (DynDNS name or an address behind a VPN). */
export function ConnectivityFields({
  type,
  host,
  port,
  vpn,
}: {
  type: ConnectivityType | null;
  host: string | null;
  port: number | null;
  vpn: string | null;
}) {
  const t = useTranslations("connectivity");
  const [kind, setKind] = useState<string>(type ?? "");
  return (
    <section className="space-y-4 border-t border-border pt-4">
      <h3 className="text-sm font-semibold">{t("title")}</h3>
      <Field label={t("type")} hint={t("typeHint")}>
        <Select name="connectivityType" value={kind} onChange={(e) => setKind(e.target.value)} className="sm:max-w-60">
          <option value="">{t("none")}</option>
          <option value="DYNDNS">{t("DYNDNS")}</option>
          <option value="VPN">{t("VPN")}</option>
        </Select>
      </Field>
      {kind === "VPN" && (
        <Field label={t("vpnName")} hint={t("vpnNameHint")}>
          <Input name="connectivityVpn" defaultValue={vpn ?? ""} placeholder={t("vpnNamePlaceholder")} />
          <FieldError name="connectivityVpn" />
        </Field>
      )}
      {kind && (
        <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
          <Field label={kind === "VPN" ? t("vpnHost") : t("dyndnsHost")} hint={kind === "VPN" ? t("vpnHostHint") : t("dyndnsHostHint")}>
            <Input
              name="connectivityHost"
              defaultValue={host ?? ""}
              placeholder={kind === "VPN" ? "10.8.0.17" : "villa7.dyndns.org"}
              className="font-mono"
              required
            />
            <FieldError name="connectivityHost" />
          </Field>
          <Field label={t("port")} hint={t("portHint")}>
            <Input name="connectivityPort" type="number" min={1} max={65535} defaultValue={port ?? ""} placeholder={t("portPlaceholder")} />
            <FieldError name="connectivityPort" />
          </Field>
        </div>
      )}
    </section>
  );
}
