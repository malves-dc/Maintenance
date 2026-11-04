import type { OfflineWorkOrder, QueuedOp, Snapshot } from "@/lib/offline-types";

// What the technician sees = the last server snapshot with their not-yet-synced changes laid on top.
// Pure, so it's unit-tested and runs identically on every render.

export const PENDING_PHOTO = "pending:";

export function applyOps(snapshot: Snapshot, ops: QueuedOp[], me: string): OfflineWorkOrder[] {
  const byId = new Map(snapshot.workOrders.map((w) => [w.id, structuredClone(w)]));
  for (const op of ops) {
    const wo = byId.get(op.woId);
    if (!wo) continue;
    switch (op.kind) {
      case "photo":
        if (op.signOffName) {
          wo.signOff = { name: op.signOffName, at: op.at, pending: true };
          wo.clientAbsent = false;
          break;
        }
      // falls through: a checklist photo/signature answer
      case "answer": {
        const item = wo.items.find((i) => i.id === (op.kind === "answer" ? op.itemId : op.itemId ?? ""));
        if (!item) break;
        item.value = op.kind === "answer" ? op.value : `${PENDING_PHOTO}${op.blobKey}`;
        if (op.kind === "answer" && op.note !== undefined) item.note = op.note ?? null;
        item.completedBy = item.value ? me : null;
        if (item.value && wo.status === "OPEN") wo.status = "IN_PROGRESS";
        break;
      }
      case "comment":
        wo.comments.push({ id: op.id, user: me, body: op.body, at: op.at });
        break;
      case "time":
        wo.minutesLogged += Math.max(0, Math.round((new Date(op.endedAt).getTime() - new Date(op.startedAt).getTime()) / 60_000));
        if (wo.status === "OPEN" || wo.status === "ON_HOLD") wo.status = "IN_PROGRESS";
        break;
      case "status":
        wo.status = op.status;
        break;
      case "signoff":
        wo.signOff = { name: op.name, at: op.at };
        wo.clientAbsent = false;
        break;
      case "clientAbsent":
        if (!wo.signOff) wo.clientAbsent = op.absent;
        break;
      case "report":
        wo.workReport = op.text.trim() || null;
        break;
    }
  }
  return snapshot.workOrders.map((w) => byId.get(w.id)!);
}

/** Checklist items still blocking "Done" (headings never count). */
export function missingRequired(wo: OfflineWorkOrder) {
  return wo.items.filter((i) => {
    if (!i.required || i.type === "HEADING") return false;
    if (i.type === "CHECKBOX") return i.value !== "true";
    return !i.value || i.value.trim() === "";
  });
}
