"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { FieldError } from "@/components/action-form";
import { Field, Select } from "@/components/ui";

type VillaOption = { id: string; name: string };
export type ClientOption = { id: string; name: string; owned: VillaOption[]; managed: (VillaOption & { owner: string | null })[] };

/** Client, then only that client's villas (owned, and those it manages for other owners). */
export function ClientVillaFields({ clients, clientId: initialClient, villaId: initialVilla }: { clients: ClientOption[]; clientId: string; villaId: string }) {
  const t = useTranslations();
  const [clientId, setClientId] = useState(initialClient);
  const [villaId, setVillaId] = useState(initialVilla);
  const client = clients.find((c) => c.id === clientId);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={t("villas.client")}>
        <Select
          name="clientId"
          value={clientId}
          onChange={(e) => {
            setClientId(e.target.value);
            setVillaId(""); // a villa of the previous client no longer applies
          }}
          required
        >
          <option value="" disabled>
            —
          </option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <FieldError name="clientId" />
      </Field>
      <Field label={t("assets.villa")} hint={client ? t("contracts.villaHint") : t("contracts.pickClientFirst")}>
        <Select name="villaId" value={villaId} onChange={(e) => setVillaId(e.target.value)} disabled={!client}>
          <option value="">{t("contracts.allVillas")}</option>
          {client && client.owned.length > 0 && (
            <optgroup label={t("contracts.ownedVillas")}>
              {client.owned.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </optgroup>
          )}
          {client && client.managed.length > 0 && (
            <optgroup label={t("contracts.managedVillas")}>
              {client.managed.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.owner ? `${v.name} (${v.owner})` : v.name}
                </option>
              ))}
            </optgroup>
          )}
        </Select>
        <FieldError name="villaId" />
      </Field>
    </div>
  );
}
