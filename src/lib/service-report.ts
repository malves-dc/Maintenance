import "server-only";
import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { getFormatter, getTranslations } from "next-intl/server";
import type { Prisma } from "@/generated/prisma/client";
import type { AppContext } from "@/lib/context";
import { getObject } from "@/lib/storage";
import { letterhead } from "@/lib/letterhead";
import { INTL_LOCALE, type Locale } from "@/i18n/config";
import { ServiceReport, type ReportData } from "@/app/(app)/work-orders/[id]/report/report-pdf";
import { billedTime, timeRoundingOf } from "@/lib/billing-time";
import { urgentApplies, urgentRuleFor } from "@/lib/urgent-surcharge";
import { villaClient } from "@/lib/villa-client";

// The client-facing PDF service report of a work order (no costs). Used by the download route and by
// e-mailing (lib/report-email.ts). `where` scopes the work order (tenant + portal rules are the caller's);
// `locale` renders it in another language than the current request's (e.g. the company's default).

const MAX_PHOTOS = 12;
const PDF_IMAGE_TYPES = new Set(["image/jpeg", "image/png"]);

function duration(min: number) {
  const h = Math.floor(min / 60);
  return h ? `${h}h ${String(min % 60).padStart(2, "0")}m` : `${min}m`;
}

export async function renderServiceReport(ctx: Pick<AppContext, "db" | "organization">, where: Prisma.WorkOrderWhereInput, locale?: Locale) {
  const t = await getTranslations(locale ? { locale } : undefined);
  const format = await getFormatter(locale ? { locale: INTL_LOCALE[locale] } : undefined);

  const wo = await ctx.db.workOrder.findFirst({
    where,
    include: {
      villa: { select: { name: true, address: true, city: true, client: { select: { name: true } }, manager: { select: { name: true } }, billTo: true } },
      area: { select: { name: true } },
      asset: { select: { name: true, manufacturer: true, model: true, serialNumber: true } },
      assignees: { select: { user: { select: { name: true } } } },
      completedBy: { select: { name: true } },
      items: { orderBy: { sortOrder: "asc" } },
      timeEntries: { where: { minutes: { not: null } }, include: { user: { select: { name: true } } }, orderBy: { startedAt: "asc" } },
      attachments: { where: { mimeType: { in: [...PDF_IMAGE_TYPES] } }, orderBy: { createdAt: "asc" } },
      parts: { include: { part: { select: { name: true, sku: true, unit: true } } }, orderBy: { id: "asc" } },
      contract: { select: { urgentFee: true, urgentPercent: true } },
    },
  });
  if (!wo) return null;

  const dt = (d: Date) => format.dateTime(d, { dateStyle: "medium", timeStyle: "short" });
  const load = (attId: string) => {
    const att = wo.attachments.find((a) => a.id === attId);
    return att ? getObject(att.url).catch(() => null) : Promise.resolve(null);
  };

  const answer = (type: string, value: string | null, unit: string | null) => {
    if (!value) return "—";
    // Built-in PDF fonts are WinAnsi-only (no ✓), so use words.
    if (type === "CHECKBOX") return value === "true" ? t("checklist.yes") : "—";
    if (type === "PASS_FAIL") return t(`checklist.pf.${value}` as never);
    if (type === "PHOTO") return t("report.seePhotos");
    const shown = (type === "NUMBER" || type === "METER_READING") && !isNaN(Number(value)) ? format.number(Number(value)) : value;
    return unit ? `${shown} ${unit}` : shown;
  };

  // Client-facing time is the billed time: one line per technician, their time on this work order rounded up to
  // the company's billing period (lib/billing-time.ts), with the dates and notes of their entries.
  const billed = billedTime(wo.timeEntries, timeRoundingOf(ctx.organization.timeRounding));
  const day = (d: Date) => format.dateTime(d, { dateStyle: "short" });
  const timeRows = billed.people.map((p) => {
    const mine = wo.timeEntries.filter((e) => (e.userId ?? "-") === p.userId);
    const first = day(mine[0].startedAt);
    const last = day(mine[mine.length - 1].startedAt);
    return { who: mine[0].user.name, when: first === last ? first : `${first} – ${last}`, duration: duration(p.billed), note: mine.map((e) => e.note).filter(Boolean).join("; ") || null };
  });

  const signatureIds = new Set([wo.signatureUrl, ...wo.items.filter((i) => i.type === "SIGNATURE").map((i) => i.value)]);
  const photoAtts = wo.attachments.filter((a) => !signatureIds.has(a.id)).slice(0, MAX_PHOTOS);

  const asset = wo.asset
    ? [wo.asset.name, [wo.asset.manufacturer, wo.asset.model].filter(Boolean).join(" "), wo.asset.serialNumber && `S/N ${wo.asset.serialNumber}`]
        .filter(Boolean)
        .join(" · ")
    : null;

  const info: [string, string | null | undefined][] = [
    [t("villas.client"), wo.villa && villaClient(wo.villa)?.name],
    [t("assets.villa"), wo.villa && [wo.villa.name, wo.villa.city].filter(Boolean).join(", ")],
    [t("assets.area"), wo.area?.name],
    [t("wo.asset"), asset],
    [t("assets.system"), wo.system && t(`systems.${wo.system}`)],
    [t("wo.type"), t(`woType.${wo.type}`)],
    // Billed as urgent (the surcharge applies): the client sees it, without amounts.
    [t("report.service"), urgentApplies(wo.priority, urgentRuleFor(ctx.organization, wo.contract)) ? t("report.urgentService") : null],
    [t("common.status"), t(`woStatus.${wo.status}`)],
    [t("wo.technicians"), wo.assignees.map((a) => a.user.name).join(", ")],
    [t("wo.createdAt"), dt(wo.createdAt)],
    [t("wo.completedAt"), wo.completedAt && dt(wo.completedAt)],
  ];

  const data: ReportData = {
    labels: {
      reportTitle: t("report.title"),
      description: t("wo.descriptionLabel"),
      checklist: t("checklist.title"),
      time: t("time.title"),
      total: t("time.total"),
      photos: t("report.photos"),
      parts: t("woParts.title"),
      serials: t("serials.short"),
      signoff: t("signoff.title"),
      clientAbsent: t("signoff.absentNote"),
    },
    lh: await letterhead(ctx.organization, t("company.taxIdShort")),
    number: wo.number,
    title: wo.title,
    generatedAt: dt(new Date()),
    info: info.filter((x): x is [string, string] => !!x[1]),
    description: wo.description,
    checklist: await Promise.all(
      wo.items.map(async (i) => ({
        label: i.label,
        heading: i.type === "HEADING",
        answer: answer(i.type, i.value, i.unit),
        note: i.note,
        image: i.type === "SIGNATURE" && i.value ? await load(i.value) : null,
      })),
    ),
    time: timeRows,
    // Parts used (quantities only: the report is client-facing, so no costs).
    parts: wo.parts.map((p) => ({ name: p.part.name, sku: p.part.sku, qty: `${format.number(Number(p.quantity))} ${p.part.unit}`, serials: p.serialNumbers })),
    totalTime: duration(billed.billed),
    photos: (await Promise.all(photoAtts.map((a) => getObject(a.url).catch(() => null)))).filter((b): b is Buffer => !!b),
    signature:
      wo.signatureUrl && wo.signedByName && wo.signedAt
        ? await load(wo.signatureUrl).then((image) => (image ? { image, name: wo.signedByName!, at: dt(wo.signedAt!) } : null))
        : null,
    clientAbsent: wo.clientAbsent,
  };

  const pdf = await renderToBuffer(createElement(ServiceReport, { d: data }) as unknown as ReactElement<DocumentProps>);
  return { pdf, number: wo.number, title: wo.title, villa: wo.villa?.name ?? null };
}
