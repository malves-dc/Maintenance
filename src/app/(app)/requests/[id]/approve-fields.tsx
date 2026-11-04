"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { FieldError } from "@/components/action-form";
import { DateTimeField } from "@/components/datetime-field";
import { Field, Input, Select } from "@/components/ui";
import { cn } from "@/lib/utils";
import { Priority, SystemType, WorkOrderType } from "@/generated/prisma/enums";

export function ApproveFields({
  title,
  priority,
  system,
  teams,
  people,
  initialAssignees = [],
  clientWindow,
}: {
  title: string;
  priority: Priority;
  system: SystemType | null;
  teams: { id: string; name: string; memberIds: string[] }[];
  people: { id: string; name: string }[];
  initialAssignees?: string[];
  /** The client's availability, already formatted; when set, a confirmed visit is required. */
  clientWindow?: string | null;
}) {
  const t = useTranslations();
  const [assignees, setAssignees] = useState<Set<string>>(() => new Set(initialAssignees));
  const toggle = (id: string) =>
    setAssignees((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <>
      <Field label={t("wo.title")}>
        <Input name="title" defaultValue={title} required />
        <FieldError name="title" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t("wo.priority")}>
          <Select name="priority" defaultValue={priority === "NONE" ? "MEDIUM" : priority}>
            {Object.values(Priority).map((v) => (
              <option key={v} value={v}>
                {t(`priority.${v}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("wo.type")}>
          <Select name="type" defaultValue="REACTIVE">
            {Object.values(WorkOrderType).map((v) => (
              <option key={v} value={v}>
                {t(`woType.${v}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("assets.system")}>
          <Select name="system" defaultValue={system ?? ""}>
            <option value="">—</option>
            {Object.values(SystemType).map((s) => (
              <option key={s} value={s}>
                {t(`systems.${s}`)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className={cn("rounded-md p-3", clientWindow ? "border border-amber-300 bg-amber-50" : "bg-gray-50")}>
        {clientWindow && <p className="mb-2 text-sm">{t("requests.clientWindow", { window: clientWindow })}</p>}
        <Field label={clientWindow ? t("requests.confirmVisitRequired") : t("requests.confirmVisit")}>
          <DateTimeField name="scheduledFor" />
          <FieldError name="scheduledFor" />
        </Field>
        <p className="mt-1 text-xs text-muted">{t("requests.confirmVisitHint")}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("wo.dueDate")}>
          <DateTimeField name="dueDate" />
        </Field>
        <Field label={t("wo.team")}>
          <Select
            name="teamId"
            defaultValue=""
            onChange={(e) => {
              const team = teams.find((x) => x.id === e.target.value);
              if (team && assignees.size === 0) setAssignees(new Set(team.memberIds));
            }}
          >
            <option value="">—</option>
            {teams.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">{t("wo.assignees")}</legend>
        <div className="flex flex-wrap gap-2">
          {people.map((p) => (
            <label
              key={p.id}
              className={cn("cursor-pointer rounded-full border px-3 py-1 text-sm", assignees.has(p.id) ? "border-brand bg-brand/10 text-brand" : "border-border")}
            >
              <input type="checkbox" name="assigneeIds" value={p.id} checked={assignees.has(p.id)} onChange={() => toggle(p.id)} className="sr-only" />
              {p.name}
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}
