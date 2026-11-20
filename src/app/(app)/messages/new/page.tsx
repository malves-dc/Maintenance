import { NOT_IN_STAFF_LISTS } from "@/lib/rbac";
import { getTranslations } from "next-intl/server";
import { Card, Field, Input } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { ActionForm, FieldError } from "@/components/action-form";
import { getContext } from "@/lib/context";
import { startConversationAction } from "../actions";

export default async function NewConversationPage() {
  const ctx = await getContext();
  const t = await getTranslations();
  const people = await ctx.db.membership.findMany({
    where: { active: true, role: { notIn: NOT_IN_STAFF_LISTS }, userId: { not: ctx.user.id } },
    select: { role: true, jobRole: { select: { name: true } }, user: { select: { id: true, name: true } } },
    orderBy: { user: { name: "asc" } },
  });

  return (
    <Card className="p-5">
      <div className="lg:hidden">
        <BackLink href="/messages" label={t("nav.messages")} />
      </div>
      <h2 className="mb-1 font-medium">{t("messages.new")}</h2>
      <p className="mb-4 text-sm text-muted">{t("messages.newHint")}</p>
      <ActionForm action={startConversationAction} submitLabel={t("messages.start")}>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">{t("messages.people")}</legend>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {people.map((p) => (
              <li key={p.user.id}>
                <label className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-gray-50">
                  <input type="checkbox" name="userIds" value={p.user.id} className="size-4 accent-brand" />
                  <span className="flex-1">{p.user.name}</span>
                  <span className="text-xs text-muted">{p.jobRole?.name ?? t(`roles.${p.role}`)}</span>
                </label>
              </li>
            ))}
          </ul>
          <FieldError name="userIds" />
        </fieldset>
        <Field label={t("messages.groupName")} hint={t("messages.groupNameHint")}>
          <Input name="name" maxLength={100} />
        </Field>
      </ActionForm>
    </Card>
  );
}
