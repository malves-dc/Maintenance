import "server-only";
import { createTranslator } from "next-intl";
import type { AppContext } from "@/lib/context";
import { Role } from "@/generated/prisma/enums";
import { emailLayout, sendEmail } from "@/lib/email";
import { orgBrand } from "@/lib/notify";
import { appOrigin } from "@/lib/qr";
import { audit } from "@/lib/audit";
import { renderServiceReport } from "@/lib/service-report";
import { isLocale } from "@/i18n/config";
import { villaClient } from "@/lib/villa-client";
import { mergeRecipients, parseCompanyRecipients, type Recipient } from "@/lib/report-recipients";
import en from "../../messages/en.json";
import pt from "../../messages/pt.json";

// E-mailing the PDF service report (sent by hand from the work-order page). See lib/report-recipients.ts
// for who is offered by default.

const BUILT_IN = new Set<string>(Object.values(Role));

const recipientFields = {
  name: true,
  email: true,
  reportEmails: true,
  contacts: { where: { receivesReports: true }, select: { name: true, email: true } },
} as const;

/** The work order and its default recipients: the client, its report contacts and addresses, then the company's list. */
export async function reportRecipients(ctx: Pick<AppContext, "db" | "organization">, workOrderId: string) {
  const wo = await ctx.db.workOrder.findFirst({
    where: { id: workOrderId },
    select: {
      id: true,
      number: true,
      reportSentAt: true,
      reportSentTo: true,
      villa: { select: { client: { select: recipientFields }, manager: { select: recipientFields }, billTo: true } },
    },
  });
  if (!wo) return null;
  // No owner: the report goes to the managing company.
  const client = wo.villa && villaClient(wo.villa);
  const company = parseCompanyRecipients(ctx.organization.reportRecipients);
  const roles = company.roles.filter((r) => BUILT_IN.has(r) && r !== "REQUESTER") as Role[];
  const jobRoleIds = company.roles.filter((r) => r.startsWith("job:")).map((r) => r.slice(4));
  const members =
    company.userIds.length || roles.length || jobRoleIds.length
      ? await ctx.db.membership.findMany({
          where: {
            active: true,
            role: { not: "REQUESTER" },
            OR: [{ userId: { in: company.userIds } }, { role: { in: roles } }, { jobRoleId: { in: jobRoleIds } }],
          },
          select: { user: { select: { name: true, email: true } } },
        })
      : [];

  const recipients = mergeRecipients(
    client?.email ? [{ email: client.email, name: client.name, source: "client" }] : [],
    (client?.contacts ?? []).flatMap((c): Recipient[] => (c.email ? [{ email: c.email, name: c.name, source: "contact" }] : [])),
    (client?.reportEmails ?? []).map((email): Recipient => ({ email, name: null, source: "clientExtra" })),
    members.map((m): Recipient => ({ email: m.user.email, name: m.user.name, source: "company" })),
    company.emails.map((email): Recipient => ({ email, name: null, source: "company" })),
  );
  return { wo, recipients };
}

/** Renders the report in the company's language and sends it to each address separately (no one sees the others). */
export async function sendServiceReport(ctx: AppContext, workOrderId: string, to: string[]) {
  const locale = isLocale(ctx.organization.defaultLocale) ? ctx.organization.defaultLocale : "en";
  const report = await renderServiceReport(ctx, { id: workOrderId }, locale);
  if (!report) throw new Error("Not found");
  const brand = await orgBrand(ctx.organization.id, await appOrigin());
  const t = createTranslator({ locale, messages: locale === "pt" ? pt : en, namespace: "reportEmail" });
  const vars = { number: report.number, title: report.title, villa: report.villa ?? "", company: ctx.organization.name };
  const mail = emailLayout({
    ...brand,
    heading: t("subject", vars),
    paragraphs: [report.villa ? t("bodyVilla", vars) : t("body", vars), t("signature", vars)],
    privacy: { label: t("privacy"), url: brand.privacyUrl },
  });
  const attachments = [{ filename: `WO-${report.number}.pdf`, content: report.pdf }];
  for (const email of to) await sendEmail({ to: email, subject: t("subject", vars), ...mail, attachments });

  await ctx.db.workOrder.update({ where: { id: workOrderId }, data: { reportSentAt: new Date(), reportSentTo: to } });
  await audit(ctx, "workOrder.reportSent", "WorkOrder", workOrderId, { to });
}
