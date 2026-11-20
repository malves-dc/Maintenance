"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Select } from "@/components/ui";

/** Managers: whose week to show. */
export function PersonPicker({ people, value, self, week }: { people: { id: string; name: string }[]; value: string; self: string; week: string }) {
  const t = useTranslations("hours");
  const router = useRouter();
  return (
    <Select
      aria-label={t("person")}
      value={value}
      onChange={(e) => router.push(`/horas/registos?week=${week}${e.target.value === self ? "" : `&user=${e.target.value}`}`)}
    >
      {!people.some((p) => p.id === value) && <option value={value}>—</option>}
      {people.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
          {p.id === self ? ` (${t("me")})` : ""}
        </option>
      ))}
    </Select>
  );
}
