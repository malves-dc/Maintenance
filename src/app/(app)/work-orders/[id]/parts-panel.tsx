"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ScanLine, Trash2, Undo2 } from "lucide-react";
import { Scanner } from "@/components/scanner";
import { ActionForm, FieldError } from "@/components/action-form";
import { Input, Select } from "@/components/ui";
import { SerialList } from "@/components/serial-list";
import { addManualPartAction, addPartAction, returnPartAction } from "../actions";

export type UsedPart = { id: string; partId: string | null; name: string; qty: string; location: string | null; cost: string | null; serials: string[] };
export type PartOption = { id: string; name: string; sku: string | null; barcode: string | null; unit: string; compatible: boolean; stock: Record<string, number> };

export function PartsPanel({
  woId,
  used,
  options,
  locations,
  defaultLocationId,
  canUse,
  orderHref,
  showCost,
}: {
  woId: string;
  used: UsedPart[];
  options: PartOption[];
  locations: { id: string; name: string }[];
  defaultLocationId: string | null;
  canUse: boolean;
  orderHref: string | null; // "order parts for this WO" (purchasing users)
  showCost: boolean;
}) {
  const t = useTranslations();
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [manual, setManual] = useState(false);
  const [partId, setPartId] = useState("");
  const [locationId, setLocationId] = useState(defaultLocationId ?? locations[0]?.id ?? "");
  const [scanning, setScanning] = useState(false);
  const [qty, setQty] = useState("1");
  const [unknownCode, setUnknownCode] = useState<string | null>(null);
  // A scanned barcode or SKU picks the part.
  const onScan = (code: string) => {
    setScanning(false);
    const c = code.trim().toLowerCase();
    const hit = options.find((p) => p.barcode?.toLowerCase() === c || p.sku?.toLowerCase() === c);
    setUnknownCode(hit ? null : code);
    if (hit) {
      setPartId(hit.id);
      setAdding(true);
    }
  };
  const part = options.find((p) => p.id === partId);
  const available = part ? (part.stock[locationId] ?? 0) : null;
  const compatible = options.filter((p) => p.compatible);
  const rest = options.filter((p) => !p.compatible);
  const option = (p: PartOption) => (
    <option key={p.id} value={p.id}>
      {p.name}
      {p.sku ? ` (${p.sku})` : ""}
    </option>
  );

  return (
    <div className="space-y-2 text-sm">
      {scanning && <Scanner onResult={onScan} onClose={() => setScanning(false)} />}
      {unknownCode && <p className="text-xs text-danger">{t("scan.partNotFound", { code: unknownCode })}</p>}
      {used.length === 0 && !adding && !manual && <p className="text-muted">{t("woParts.none")}</p>}
      {used.length > 0 && (
        <ul className="divide-y divide-border">
          {used.map((u) => (
            <li key={u.id} className="flex items-start justify-between gap-2 py-1.5">
              <span className="min-w-0">
                {u.partId ? (
                  <Link href={`/parts/${u.partId}`} className="font-medium hover:text-brand">
                    {u.name}
                  </Link>
                ) : (
                  <span className="font-medium">{u.name}</span>
                )}
                {u.location && <span className="block text-xs text-muted">{u.location}</span>}
                {u.serials.length > 0 && (
                  <span className="block font-mono text-xs text-muted" title={t("serials.label")}>
                    {t("serials.short")} {u.serials.join(", ")}
                  </span>
                )}
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <span className="text-right tabular-nums">
                  {u.qty}
                  {u.cost && <span className="block text-xs text-muted">{u.cost}</span>}
                </span>
                {canUse && (
                  <button
                    className="rounded p-1 text-muted hover:text-danger"
                    title={t(u.partId ? "woParts.return" : "woParts.remove")}
                    disabled={pending}
                    onClick={() => confirm(t(u.partId ? "woParts.returnConfirm" : "woParts.removeConfirm")) && start(() => returnPartAction(woId, u.id))}
                  >
                    {u.partId ? <Undo2 className="size-3.5" /> : <Trash2 className="size-3.5" />}
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {canUse && manual && (
        // Re-created after each one added, so the form starts empty.
        <ActionForm key={used.length} action={addManualPartAction.bind(null, woId)} submitLabel={t("common.add")} className="rounded-md border border-border p-3">
          <Input name="quantity" type="number" step="any" min={0} defaultValue="1" required className="w-24" aria-label={t("stock.quantity")} />
          <FieldError name="quantity" />
          <Input name="model" maxLength={120} placeholder={t("woParts.model")} aria-label={t("woParts.model")} />
          <FieldError name="model" />
          <Input name="description" maxLength={300} required placeholder={t("woParts.description")} aria-label={t("woParts.description")} />
          <FieldError name="description" />
          {showCost && <Input name="unitCost" type="number" step="any" min={0} placeholder={t("woParts.unitCost")} aria-label={t("woParts.unitCost")} />}
          {showCost && <FieldError name="unitCost" />}
        </ActionForm>
      )}
      {canUse &&
        (adding ? (
          options.length === 0 ? (
            <p className="text-muted">{t("woParts.noParts")}</p>
          ) : (
            <ActionForm action={addPartAction.bind(null, woId)} submitLabel={t("common.add")} className="rounded-md border border-border p-3">
              <Select name="partId" value={partId} onChange={(e) => setPartId(e.target.value)} required aria-label={t("parts.part")}>
                <option value="" disabled>
                  {t("woParts.pick")}
                </option>
                {compatible.length > 0 && <optgroup label={t("woParts.compatible")}>{compatible.map(option)}</optgroup>}
                {compatible.length === 0 ? rest.map(option) : rest.length > 0 && <optgroup label={t("woParts.otherParts")}>{rest.map(option)}</optgroup>}
              </Select>
              <FieldError name="partId" />
              <Select name="locationId" value={locationId} onChange={(e) => setLocationId(e.target.value)} aria-label={t("stock.location")}>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
              <div className="flex items-center gap-2">
                <Input name="quantity" type="number" step="any" min={0} value={qty} onChange={(e) => setQty(e.target.value)} required className="w-24" aria-label={t("stock.quantity")} />
                {part && <span className="text-xs text-muted">{part.unit}</span>}
                {available !== null && (
                  <span className={available > 0 ? "text-xs text-muted" : "text-xs text-danger"}>{t("woParts.available", { qty: available })}</span>
                )}
              </div>
              <FieldError name="quantity" />
              <SerialList key={partId} name="serials" max={Number(qty) || 1} />
            </ActionForm>
          )
        ) : (
          <div className="flex flex-wrap gap-x-4">
            <button className="text-xs font-medium text-brand" onClick={() => setAdding(true)}>
              + {t("woParts.add")}
            </button>
            {!manual && (
              <button className="text-xs font-medium text-muted hover:text-brand" onClick={() => setManual(true)}>
                + {t("woParts.addManual")}
              </button>
            )}
            {options.length > 0 && (
              <button className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-brand" onClick={() => setScanning(true)}>
                <ScanLine className="size-3.5" />
                {t("scan.scanPart")}
              </button>
            )}
            {orderHref && (
              <Link href={orderHref} className="text-xs font-medium text-muted hover:text-brand">
                {t("woParts.order")}
              </Link>
            )}
          </div>
        ))}
    </div>
  );
}
