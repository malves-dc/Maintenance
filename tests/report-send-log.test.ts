import { describe, expect, it } from "vitest";
import { groupSends } from "@/lib/report-send-log";

const at = (s: string) => new Date(`2026-11-${s}Z`);

describe("report send history", () => {
  it("groups the addresses of each send, newest first", () => {
    const log = groupSends([
      { email: "client@x.pt", sentAt: at("20T10:00:00"), auto: false, revision: 0, sentBy: { name: "Sofia" } },
      { email: "office@x.pt", sentAt: at("20T10:00:00"), auto: false, revision: 0, sentBy: { name: "Sofia" } },
      { email: "ana@co.pt", sentAt: at("21T09:30:00"), auto: true, revision: 1, sentBy: { name: "Rui" } },
      { email: "old@x.pt", sentAt: at("01T08:00:00"), auto: false, revision: null, sentBy: null },
    ]);
    expect(log).toEqual([
      { at: at("21T09:30:00"), by: "Rui", auto: true, revision: 1, to: ["ana@co.pt"] },
      { at: at("20T10:00:00"), by: "Sofia", auto: false, revision: 0, to: ["client@x.pt", "office@x.pt"] },
      { at: at("01T08:00:00"), by: null, auto: false, revision: null, to: ["old@x.pt"] },
    ]);
  });

  it("keeps two sends at the same moment apart when someone else sent them", () => {
    const log = groupSends([
      { email: "a@x.pt", sentAt: at("20T10:00:00"), auto: false, revision: 0, sentBy: { name: "Sofia" } },
      { email: "b@x.pt", sentAt: at("20T10:00:00"), auto: true, revision: 0, sentBy: { name: "Sofia" } },
    ]);
    expect(log).toHaveLength(2);
  });
});
