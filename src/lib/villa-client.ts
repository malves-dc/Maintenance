import type { BillTo } from "@/generated/prisma/enums";

// A villa has an owner, a property manager / managing company, or both (never neither: a check
// constraint enforces it). Its work is billed and reported to the one `billTo` names; when the villa
// has only one of them, that one.

/** The villa's billing client: the one `billTo` names, or whichever of owner / manager it has. */
export function villaClient<C>(v: { client: C | null; manager?: C | null; billTo: BillTo }): C | null {
  if (v.billTo === "MANAGER" && v.manager) return v.manager;
  return v.client ?? v.manager ?? null;
}

/** `billTo` as stored: the chosen side when the villa has both, else the side it has. */
export function normalizeBillTo(v: { clientId: string | null; managerId: string | null; billTo: BillTo }): BillTo {
  if (!v.clientId) return "MANAGER";
  if (!v.managerId) return "OWNER";
  return v.billTo;
}

/** The ids of the clients a villa belongs to (owner and/or manager). */
export function villaClientIds(v: { clientId: string | null; managerId: string | null }): string[] {
  return [v.clientId, v.managerId].filter((id): id is string => !!id);
}
