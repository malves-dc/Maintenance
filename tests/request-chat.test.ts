import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
// tenantDb() hands its extension to prisma.$extends: return it so the guard can be called directly.
vi.mock("@/lib/db/client", () => ({ prisma: { $extends: (ext: unknown) => ext } }));

import { breaksAppendOnly, mayChat, type ChatRequest, type ChatViewer } from "@/lib/request-chat-rules";
import { portalScopes } from "@/lib/portal-scope";
import { defaultPermissions, effectivePermissions } from "@/lib/rbac";
import { tenantDb } from "@/lib/db/tenant";

// A request on a villa owned by "whitmore" and managed by property manager "pm", made by portal user
// "james" (Whitmore), and turned into a work order assigned to technician "rui".
const request: ChatRequest = { requesterId: "james", villa: { clientId: "whitmore", managerId: "pm" }, assigneeIds: ["rui"] };

const portal = (userId: string, clientId: string | null): ChatViewer => ({ userId, portal: true, clientId, canManage: false });
const staff = (userId: string, canManage: boolean): ChatViewer => ({ userId, portal: false, clientId: null, canManage });

describe("request chat: who takes part", () => {
  it("lets in the requester, the villa owner's and the property manager's portal users", () => {
    expect(mayChat(portal("james", "whitmore"), request)).toBe(true);
    expect(mayChat(portal("wife", "whitmore"), request)).toBe(true); // another owner user
    expect(mayChat(portal("agent", "pm"), request)).toBe(true); // property manager
  });

  it("keeps out every other client's portal users", () => {
    expect(mayChat(portal("eva", "bergstrom"), request)).toBe(false);
    expect(mayChat(portal("nobody", null), request)).toBe(false);
    // A portal user can't borrow staff rights.
    expect(mayChat({ ...portal("eva", "bergstrom"), canManage: true }, request)).toBe(false);
    // Nor be let in by being assigned to the job.
    expect(mayChat(portal("rui", "bergstrom"), request)).toBe(false);
  });

  it("a requester with no villa or no client only reaches their own requests", () => {
    const qr = { requesterId: null, villa: null, assigneeIds: [] };
    expect(mayChat(portal("james", "whitmore"), qr)).toBe(false);
    expect(mayChat(portal("james", null), { ...qr, requesterId: "james" })).toBe(true);
  });

  it("lets in managers and the technicians assigned to the work order, nobody else on staff", () => {
    expect(mayChat(staff("miguel", true), request)).toBe(true);
    expect(mayChat(staff("rui", false), request)).toBe(true);
    expect(mayChat(staff("daniel", false), request)).toBe(false); // technician on other jobs
    expect(mayChat(staff("ana", false), request)).toBe(false); // viewer
    expect(mayChat(staff("daniel", false), { ...request, assigneeIds: [] })).toBe(false); // not approved yet
  });

  it("matches the portal's own request scope", () => {
    // Evaluates portalScopes().requestWhere against the request (enough for OR / equals).
    const row = { requesterId: request.requesterId, villa: request.villa! };
    const matches = (obj: Record<string, unknown>, where: Record<string, unknown>): boolean =>
      Object.entries(where).every(([k, cond]) =>
        k === "OR"
          ? (cond as Record<string, unknown>[]).some((w) => matches(obj, w))
          : cond && typeof cond === "object"
            ? matches(obj[k] as Record<string, unknown>, cond as Record<string, unknown>)
            : obj[k] === cond,
      );
    for (const [user, client] of [["james", "whitmore"], ["x", "whitmore"], ["y", "pm"], ["z", "bergstrom"], ["james", "bergstrom"]] as const) {
      expect(mayChat(portal(user, client), request)).toBe(matches(row, portalScopes(client, user).requestWhere));
    }
  });

  it("gives the requests.chat permission to managers by default, never to clients or technicians", () => {
    expect(defaultPermissions("MANAGER")).toContain("requests.chat");
    expect(defaultPermissions("ADMIN")).toContain("requests.chat");
    expect(defaultPermissions("TECHNICIAN")).not.toContain("requests.chat");
    expect(defaultPermissions("VIEWER")).not.toContain("requests.chat");
    expect(effectivePermissions("REQUESTER", { REQUESTER: ["requests.chat"] }).has("requests.chat")).toBe(false);
  });
});

describe("request chat: messages are never edited or deleted", () => {
  it("flags every write except create on RequestMessage", () => {
    for (const op of ["update", "updateMany", "updateManyAndReturn", "upsert", "delete", "deleteMany"]) {
      expect(breaksAppendOnly("RequestMessage", op)).toBe(true);
    }
    for (const op of ["create", "createMany", "findMany", "findFirst", "count"]) {
      expect(breaksAppendOnly("RequestMessage", op)).toBe(false);
    }
    expect(breaksAppendOnly("Message", "update")).toBe(false);
  });

  it("the tenant client refuses to update or delete a message", async () => {
    type Ext = { query: { $allModels: { $allOperations: (a: { model: string; operation: string; args: unknown; query: (x: unknown) => unknown }) => Promise<unknown> } } };
    const ext = tenantDb("org1") as unknown as Ext;
    const query = vi.fn(async () => "ran");
    const run = (operation: string) => ext.query.$allModels.$allOperations({ model: "RequestMessage", operation, args: { where: { id: "m1" }, data: { body: "x" } }, query });
    await expect(run("update")).rejects.toThrow(/cannot be changed or deleted/);
    await expect(run("deleteMany")).rejects.toThrow(/cannot be changed or deleted/);
    expect(query).not.toHaveBeenCalled();
    await expect(run("create")).resolves.toBe("ran");
    expect(query).toHaveBeenCalledWith(expect.objectContaining({ data: { body: "x", organizationId: "org1" } }));
  });

  it("the database blocks UPDATE and direct DELETE too", () => {
    const dir = "prisma/migrations";
    const sql = readdirSync(dir)
      .filter((d) => statSync(join(dir, d)).isDirectory())
      .map((d) => readFileSync(join(dir, d, "migration.sql"), "utf8"))
      .join("\n");
    expect(sql).toMatch(/CREATE TRIGGER "RequestMessage_append_only"\s+BEFORE UPDATE OR DELETE ON "RequestMessage"/);
  });

  it("no code changes or removes messages, and the chat exposes no way to", () => {
    const files: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) {
          if (f !== "generated") walk(p);
        } else if (/\.tsx?$/.test(f)) files.push(p);
      }
    };
    walk("src");
    const offenders = files.filter((f) => /requestMessage\s*\.\s*(update|updateMany|updateManyAndReturn|upsert|delete|deleteMany)\b/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);

    const actions = readFileSync("src/app/request-chat-actions.ts", "utf8");
    expect([...actions.matchAll(/export async function (\w+)/g)].map((m) => m[1])).toEqual(["sendRequestMessageAction"]);
    const route = readFileSync("src/app/api/request-chat/route.ts", "utf8");
    expect([...route.matchAll(/export (?:async )?function (\w+)/g)].map((m) => m[1])).toEqual(["GET"]);
  }, 60_000);
});
