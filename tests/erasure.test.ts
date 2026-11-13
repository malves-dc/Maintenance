import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

// Right to erasure (GDPR art. 17): anonymising a client must clear every text field of the Client model,
// so a field added later can't silently keep a person's details.

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client", () => ({ prisma: {} }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));

const { anonymizedClientData, clientAddresses, withoutAddresses } = await import("@/lib/erasure");

/** Text fields (String, String?, String[]) of a Prisma model, read from the schema. */
function textFields(model: string) {
  const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
  const body = schema.match(new RegExp(`model ${model} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? "";
  return body
    .split("\n")
    .map((l) => l.trim().match(/^(\w+)\s+String(\?|\[\])?(\s|$)/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => m[1]);
}

describe("anonymizedClientData", () => {
  const data = anonymizedClientData("Former client 1a2b", new Date("2026-11-12T00:00:00Z"));

  it("replaces the name and clears contact details, including report e-mails", () => {
    expect(data).toMatchObject({ name: "Former client 1a2b", email: null, phone: null, taxId: null, billingAddress: null, notes: null, reportEmails: [] });
    expect(data.anonymizedAt).toEqual(new Date("2026-11-12T00:00:00Z"));
  });

  it("covers every text field of Client except keys", () => {
    const keys = new Set(["id", "organizationId"]);
    const fields = textFields("Client").filter((f) => !keys.has(f));
    expect(fields.length).toBeGreaterThan(5);
    for (const f of fields) expect(data, `Client.${f} is not cleared on anonymisation`).toHaveProperty(f);
  });
});

describe("client e-mail addresses on sent reports", () => {
  it("collects the client's, its report copies' and its contacts' addresses, in stored and lower case", () => {
    const a = clientAddresses({ email: " Ana@Villa.pt ", reportEmails: ["office@villa.pt"] }, [{ email: null }, { email: "gardener@villa.pt" }]);
    expect(a).toEqual(expect.arrayContaining(["Ana@Villa.pt", "ana@villa.pt", "office@villa.pt", "gardener@villa.pt"]));
    expect(clientAddresses({ email: null, reportEmails: [] }, [{ email: "  " }])).toEqual([]);
  });

  it("removes only those addresses from a job's list, whatever their case", () => {
    expect(withoutAddresses(["ANA@villa.pt", "accounts@company.pt", "office@villa.pt"], ["ana@villa.pt", "office@villa.pt"])).toEqual(["accounts@company.pt"]);
  });
});
