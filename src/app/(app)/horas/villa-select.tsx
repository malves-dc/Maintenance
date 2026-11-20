import { useTranslations } from "next-intl";
import { Select } from "@/components/ui";

export type VillaOption = { id: string; name: string; code: string | null; city: string | null };

const label = (v: VillaOption) => [v.code, v.name, v.city].filter(Boolean).join(" · ");

/** Villa picker: the ones this person used lately first, then every villa. */
export function VillaSelect({ name = "villaId", recent, all, defaultValue, required = true }: { name?: string; recent: VillaOption[]; all: VillaOption[]; defaultValue?: string | null; required?: boolean }) {
  const t = useTranslations("hours");
  return (
    <Select name={name} defaultValue={defaultValue ?? ""} required={required}>
      <option value="" disabled>
        {t("pickVilla")}
      </option>
      {recent.length > 0 && (
        <optgroup label={t("recentVillas")}>
          {recent.map((v) => (
            <option key={`r-${v.id}`} value={v.id}>
              {label(v)}
            </option>
          ))}
        </optgroup>
      )}
      <optgroup label={t("allVillas")}>
        {all.map((v) => (
          <option key={v.id} value={v.id}>
            {label(v)}
          </option>
        ))}
      </optgroup>
    </Select>
  );
}
