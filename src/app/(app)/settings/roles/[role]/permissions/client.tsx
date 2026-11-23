"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { RotateCcw } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { resetRolePermissionsAction } from "../../actions";

type Group = { key: string; title: string; items: { permission: string; label: string; hint: string }[] };

/** One row per permission: its name and what it allows on the left, a single checkbox ("perm") on the right. */
export function PermissionList({ groups, granted, disabled }: { groups: Group[]; granted: string[]; disabled: boolean }) {
  const t = useTranslations("perms");
  const [on, setOn] = useState(() => new Set(granted));
  const toggle = (p: string, checked: boolean) =>
    setOn((prev) => {
      const next = new Set(prev);
      if (checked) next.add(p);
      else next.delete(p);
      return next;
    });

  return (
    <Card className="overflow-hidden [&>section:last-child>label:last-child]:border-0">
      {groups.map((g) => (
        <section key={g.key}>
          <div className="flex items-baseline justify-between border-b border-border bg-gray-50 px-5 pb-2 pt-4 text-xs text-muted">
            <span className="font-semibold uppercase tracking-wide">{g.title}</span>
            <span className="tabular-nums">{t("count", { on: g.items.filter((i) => on.has(i.permission)).length, total: g.items.length })}</span>
          </div>
          {g.items.map((i) => (
            <Row key={i.permission} label={i.label} hint={i.hint}>
              <input
                type="checkbox"
                name="perm"
                value={i.permission}
                checked={on.has(i.permission)}
                onChange={(e) => toggle(i.permission, e.target.checked)}
                disabled={disabled}
                aria-label={i.label}
                className="size-5 accent-brand disabled:opacity-60"
              />
            </Row>
          ))}
        </section>
      ))}
    </Card>
  );
}

function Row({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-6 border-b border-border px-5 py-3 hover:bg-gray-50 has-disabled:cursor-default">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted">{hint}</span>
      </span>
      {children}
    </label>
  );
}

/** Puts this role back to the defaults (a custom role: back to following its access level). */
export function ResetRolePermissionsButton({ roleKey }: { roleKey: string }) {
  const t = useTranslations("perms");
  const [pending, start] = useTransition();
  return (
    <Button type="button" size="sm" variant="secondary" className="ml-auto" disabled={pending} onClick={() => confirm(t("resetConfirm")) && start(() => resetRolePermissionsAction(roleKey))}>
      <RotateCcw className="size-4" />
      {t("reset")}
    </Button>
  );
}
