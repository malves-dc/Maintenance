// Who may read and write a request's chat (pure, so it can be tested; lib/request-chat.ts applies it).
//
// The chat lives on the request and continues on the work order(s) it becomes. Its participants are:
//  - client-portal users who reach the request through the portal scope (lib/portal-scope.ts): the person who
//    made it, and the portal users of the villa's owner and of its property manager;
//  - staff with the `requests.chat` permission (managers, by default);
//  - the technicians assigned to the linked work order(s).
// Nobody else: not other staff, and never another client's portal users.

export type ChatViewer = {
  userId: string;
  /** Portal user (role REQUESTER). */
  portal: boolean;
  /** The portal user's client company (null = none: reaches nothing but their own requests). */
  clientId: string | null;
  /** Staff with `requests.chat`. Ignored for portal users. */
  canManage: boolean;
};

export type ChatRequest = {
  requesterId: string | null;
  villa: { clientId: string | null; managerId: string | null } | null;
  /** Users assigned to the work order(s) the request turned into. */
  assigneeIds: string[];
};

export function mayChat(viewer: ChatViewer, r: ChatRequest): boolean {
  if (viewer.portal) {
    if (r.requesterId === viewer.userId) return true;
    if (!viewer.clientId || !r.villa) return false;
    return r.villa.clientId === viewer.clientId || r.villa.managerId === viewer.clientId;
  }
  return viewer.canManage || r.assigneeIds.includes(viewer.userId);
}

/** Longest message accepted. */
export const REQUEST_MESSAGE_MAX = 4000;

/** Models that only ever get new rows: the tenant client refuses any other write to them. */
export const APPEND_ONLY_MODELS = new Set(["RequestMessage"]);

const APPEND_ONLY_WRITES = new Set(["update", "updateMany", "updateManyAndReturn", "upsert", "delete", "deleteMany"]);

/** True when `operation` would change or remove rows of an append-only model. */
export function breaksAppendOnly(model: string, operation: string): boolean {
  return APPEND_ONLY_MODELS.has(model) && APPEND_ONLY_WRITES.has(operation);
}

/** One message as the chat UI gets it. */
export type ChatMessage = { id: string; body: string; at: string; author: string; fromClient: boolean; mine: boolean };

/** A request's chat as loaded for one viewer (the API and the pages hand this to <RequestChat>). */
export type ChatPayload = { requestId: string; number: number; messages: ChatMessage[] };
