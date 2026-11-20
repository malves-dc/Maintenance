"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/context";
import { assertOwned } from "@/lib/db/tenant";
import { enumOf, optStr, parseForm, str, type FormResult } from "@/lib/forms";
import { ClientType } from "@/generated/prisma/enums";
import { anonymizeClient, erasedName, ErasureError } from "@/lib/erasure";
import { MAX_EXTRA, parseEmailList } from "@/lib/report-recipients";

const clientSchema = z.object({
  name: str(150),
  type: enumOf(ClientType),
  email: optStr(200),
  phone: optStr(50),
  taxId: optStr(50),
  billingAddress: optStr(500),
  notes: optStr(5000),
});

export async function saveClientAction(id: string | null, _: FormResult, form: FormData): Promise<FormResult> {
  const ctx = await requirePermission("clients.manage");
  const parsed = parseForm(clientSchema, form);
  if (parsed.error) return parsed.error;
  const reportEmails = parseEmailList(String(form.get("reportEmails") ?? ""));
  if (reportEmails.invalid.length) return { error: "validation", fieldErrors: { reportEmails: "badEmails" } };
  if (reportEmails.emails.length > MAX_EXTRA) return { error: "validation", fieldErrors: { reportEmails: "too_big" } };
  const data = { ...parsed.data, reportEmails: reportEmails.emails };

  let clientId = id;
  if (id) {
    await ctx.db.client.update({ where: { id }, data });
  } else {
    const created = await ctx.db.client.create({ data: { ...data, organizationId: ctx.organization.id } });
    clientId = created.id;
  }
  revalidatePath("/clients");
  redirect(`/clients/${clientId}`);
}

export async function setClientArchivedAction(id: string, archived: boolean) {
  const ctx = await requirePermission("clients.manage");
  await ctx.db.client.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
}

const contactSchema = z.object({
  name: str(150),
  role: optStr(100),
  email: optStr(200),
  phone: optStr(50),
});

export async function addContactAction(clientId: string, _: FormResult, form: FormData): Promise<FormResult> {
  const ctx = await requirePermission("clients.manage");
  await assertOwned(ctx.db, "client", [clientId]);
  const parsed = parseForm(contactSchema, form);
  if (parsed.error) return parsed.error;
  const data = { ...parsed.data, receivesReports: form.get("receivesReports") === "on" };
  const existing = await ctx.db.client.findUnique({ where: { id: clientId }, select: { _count: { select: { contacts: true } } } });
  await ctx.db.clientContact.create({ data: { ...data, clientId, isPrimary: existing?._count.contacts === 0 } });
  revalidatePath(`/clients/${clientId}`);
  return { ok: true };
}

export async function deleteContactAction(clientId: string, contactId: string) {
  const ctx = await requirePermission("clients.manage");
  await assertOwned(ctx.db, "client", [clientId]);
  await ctx.db.clientContact.deleteMany({ where: { id: contactId, clientId } });
  revalidatePath(`/clients/${clientId}`);
}

/** GDPR erasure of an archived client: contact details and contacts go, villas and jobs stay. */
export async function anonymizeClientAction(id: string): Promise<{ error?: string }> {
  const ctx = await requirePermission("clients.manage");
  try {
    await anonymizeClient(ctx, id, erasedName(ctx.organization.defaultLocale, "client", id));
  } catch (e) {
    if (e instanceof ErasureError) return { error: e.message };
    throw e;
  }
  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  return {};
}

/** Whether a contact is copied on e-mailed service reports. */
export async function setContactReportsAction(clientId: string, contactId: string, receivesReports: boolean) {
  const ctx = await requirePermission("clients.manage");
  await assertOwned(ctx.db, "client", [clientId]);
  await ctx.db.clientContact.updateMany({ where: { id: contactId, clientId }, data: { receivesReports } });
  revalidatePath(`/clients/${clientId}`);
}

/** Edits a contact in place. Marking one primary unmarks the client's other contacts. */
export async function updateContactAction(clientId: string, contactId: string, _: FormResult, form: FormData): Promise<FormResult> {
  const ctx = await requirePermission("clients.manage");
  await assertOwned(ctx.db, "client", [clientId]);
  const parsed = parseForm(contactSchema, form);
  if (parsed.error) return parsed.error;
  // ClientContact has no organizationId: it is reached through its client, checked above.
  const contact = await ctx.db.clientContact.findFirst({ where: { id: contactId, clientId }, select: { id: true } });
  if (!contact) return { error: "somethingWrong" };
  const isPrimary = form.get("isPrimary") === "on";
  const data = { ...parsed.data, receivesReports: form.get("receivesReports") === "on", isPrimary };
  await ctx.db.$transaction([
    ...(isPrimary ? [ctx.db.clientContact.updateMany({ where: { clientId, id: { not: contactId }, isPrimary: true }, data: { isPrimary: false } })] : []),
    ctx.db.clientContact.update({ where: { id: contactId }, data }),
  ]);
  revalidatePath(`/clients/${clientId}`);
  return { ok: true };
}
