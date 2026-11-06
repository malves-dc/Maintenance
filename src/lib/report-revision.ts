import "server-only";
import { createHash } from "node:crypto";
import type { AppContext } from "@/lib/context";

// The service report's revision. Its content is fingerprinted when the job is completed and whenever the report is
// produced; if a completed job's content differs from the last fingerprint, the revision goes up and the PDF says so.
// Only the job's own data counts, in no particular language, so reopening a job and closing it unchanged, or opening
// the PDF in another language, is not a revision.

export const REPORT_IMAGE_TYPES = ["image/jpeg", "image/png"];

const SELECT = {
  status: true,
  reportRevision: true,
  reportFingerprint: true,
  title: true,
  description: true,
  workReport: true,
  type: true,
  system: true,
  priority: true,
  villaId: true,
  areaId: true,
  assetId: true,
  clientAbsent: true,
  signatureUrl: true,
  signedByName: true,
  signedAt: true,
  assignees: { select: { userId: true, role: true, jobRoleId: true } },
  items: { select: { id: true, label: true, value: true, note: true } },
  timeEntries: { where: { minutes: { not: null } }, select: { id: true, userId: true, minutes: true, mode: true, note: true, startedAt: true } },
  parts: { select: { id: true, partId: true, quantity: true, serialNumbers: true } },
  attachments: { where: { mimeType: { in: REPORT_IMAGE_TYPES } }, select: { id: true } },
} as const;

type Row = Record<string, unknown>;
export type ReportContent = Row & {
  assignees: (Row & { userId: string })[];
  items: (Row & { id: string })[];
  timeEntries: (Row & { id: string })[];
  parts: (Row & { id: string; quantity: unknown })[];
  attachments: { id: string }[];
};

const by = <T extends Row>(rows: T[], key: keyof T) => [...rows].sort((a, b) => String(a[key]).localeCompare(String(b[key])));

/** A hash of what the report shows, whatever order the rows came in. */
export function reportFingerprint(wo: ReportContent) {
  const content = Object.entries(wo).filter(([k]) => !["status", "reportRevision", "reportFingerprint"].includes(k));
  const fields = Object.fromEntries(content.sort(([a], [b]) => a.localeCompare(b)));
  const stable = {
    ...fields,
    assignees: by(wo.assignees, "userId"),
    items: by(wo.items, "id"),
    timeEntries: by(wo.timeEntries, "id"),
    parts: by(wo.parts, "id").map((p) => ({ ...p, quantity: Number(p.quantity) })),
    attachments: wo.attachments.map((a) => a.id).sort(),
  };
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

/** The revision of a completed job's report, raised if its content changed since the last fingerprint. */
export async function syncReportRevision(db: AppContext["db"], workOrderId: string) {
  const wo = await db.workOrder.findUnique({ where: { id: workOrderId }, select: SELECT });
  if (!wo) return 0;
  if (wo.status !== "DONE") return wo.reportRevision;
  const fingerprint = reportFingerprint(wo as unknown as ReportContent);
  if (fingerprint === wo.reportFingerprint) return wo.reportRevision;
  const reportRevision = wo.reportFingerprint ? wo.reportRevision + 1 : wo.reportRevision;
  // Guarded, so two reports produced at once raise it only once.
  await db.workOrder.updateMany({ where: { id: workOrderId, reportFingerprint: wo.reportFingerprint }, data: { reportFingerprint: fingerprint, reportRevision } });
  return reportRevision;
}

export const reportFilename = (number: number, revision: number) => `WO-${number}${revision ? `-rev${revision}` : ""}.pdf`;
