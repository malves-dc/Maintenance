"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Select } from "@/components/ui";
import { setAssigneeOfficeAction, setAssigneeRoleAction } from "../actions";

/**
 * value: the role on this job (Technician, a company role's id, or "" for an own role that can't be taken on a job).
 * office (when the company has offices): where the person leaves from for this job ("" = their primary office,
 * `ownOffice`), which sets the distance their trips are charged by.
 */
export type AssigneeRow = {
  id: string;
  name: string;
  value: string;
  label: string;
  ownName: string;
  editable: boolean;
  office?: { value: string; label: string; ownOffice: string | null; editable: boolean };
};
export type RoleOption = { value: string; label: string };

/** The people on the job with the role each one takes on it; whoever may change a role gets a picker for it. */
export function Assignees({ woId, options, assignees, offices = [] }: { woId: string; options: RoleOption[]; assignees: AssigneeRow[]; offices?: RoleOption[] }) {
  const t = useTranslations();
  if (!assignees.length) return <span className="text-muted">{t("wo.unassigned")}</span>;
  return (
    <ul className="space-y-1">
      {assignees.map((a) => (
        <li key={a.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>{a.name}</span>
          {a.editable ? (
            <RolePicker woId={woId} row={a} options={options} />
          ) : (
            a.label && <span className="text-xs text-muted">({a.label})</span>
          )}
          {a.office &&
            (a.office.editable ? (
              <OfficePicker woId={woId} row={a} offices={offices} />
            ) : (
              a.office.label && <span className="text-xs text-muted">· {t("offices.leavesFrom", { office: a.office.label })}</span>
            ))}
        </li>
      ))}
    </ul>
  );
}

function RolePicker({ woId, row, options }: { woId: string; row: AssigneeRow; options: RoleOption[] }) {
  const t = useTranslations();
  const [pending, start] = useTransition();
  return (
    <Select
      aria-label={t("wo.assigneeRoleOf", { name: row.name })}
      className="h-7 w-auto py-0 pl-2 pr-7 text-xs"
      value={row.value}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value;
        start(() => setAssigneeRoleAction(woId, row.id, next));
      }}
    >
      {row.value === "" && <option value="">{row.ownName}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}

function OfficePicker({ woId, row, offices }: { woId: string; row: AssigneeRow; offices: RoleOption[] }) {
  const t = useTranslations();
  const [pending, start] = useTransition();
  const office = row.office!;
  return (
    <Select
      aria-label={t("offices.leavesFromOf", { name: row.name })}
      title={t("offices.leavesFromHint")}
      className="h-7 w-auto py-0 pl-2 pr-7 text-xs"
      value={office.value}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value;
        start(() => setAssigneeOfficeAction(woId, row.id, next));
      }}
    >
      <option value="">{office.ownOffice ? t("offices.ownOffice", { office: office.ownOffice }) : t("offices.villaOffice")}</option>
      {offices.map((o) => (
        <option key={o.value} value={o.value}>
          {t("offices.leavesFrom", { office: o.label })}
        </option>
      ))}
    </Select>
  );
}
