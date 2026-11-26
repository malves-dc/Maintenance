import { describe, expect, it } from "vitest";
import { mergeRecipients, parseCompanyRecipients, parseEmailList } from "@/lib/report-recipients";

describe("service report recipients", () => {
  it("reads typed address lists, flagging the invalid ones", () => {
    expect(parseEmailList("Office@Example.com\nana@x.pt; ana@x.pt, bad@\n  ")).toEqual({ emails: ["office@example.com", "ana@x.pt"], invalid: ["bad@"] });
    expect(parseEmailList("")).toEqual({ emails: [], invalid: [] });
  });

  it("keeps one entry per address, the client first, and skips erased accounts", () => {
    const merged = mergeRecipients(
      [{ email: "Owner@x.pt", name: "Whitmore", source: "client" }],
      [{ email: "owner@x.pt", name: "Maria", source: "contact" }, { email: "house@x.pt", name: "Maria", source: "contact" }],
      [{ email: "erased-abc@erased.invalid", name: "Former user", source: "company" }, { email: "acc@firm.pt", name: null, source: "company" }],
    );
    expect(merged.map((r) => [r.email, r.source])).toEqual([
      ["owner@x.pt", "client"],
      ["house@x.pt", "contact"],
      ["acc@firm.pt", "company"],
    ]);
  });

  it("adds addresses it was sent to before last, without relabelling suggested ones", () => {
    const merged = mergeRecipients(
      [{ email: "owner@x.pt", name: "Whitmore", source: "client" }],
      [{ email: "owner@x.pt", name: null, source: "previous" }, { email: "typed@other.pt", name: null, source: "previous" }],
    );
    expect(merged.map((r) => [r.email, r.source])).toEqual([
      ["owner@x.pt", "client"],
      ["typed@other.pt", "previous"],
    ]);
  });

  it("reads the company settings defensively", () => {
    expect(parseCompanyRecipients(null)).toEqual({ userIds: [], roles: [], emails: [] });
    expect(parseCompanyRecipients({ userIds: ["u1", 3], roles: ["ACCOUNTANT"], emails: ["a@b.pt", "nope"] })).toEqual({ userIds: ["u1"], roles: ["ACCOUNTANT"], emails: ["a@b.pt"] });
  });
});
