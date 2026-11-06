import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client", () => ({ prisma: {} }));

import { excerpt, findMentions } from "@/lib/mentions";
import { NOTIFICATION_DEFAULTS, NOTIFICATION_TYPES, prefsOf } from "@/lib/notification-types";
import { renderNotification } from "@/lib/notify";

const people = [
  { id: "rui", name: "Rui Ferreira" },
  { id: "daniel", name: "Daniel Hughes" },
  { id: "ana1", name: "Ana Costa" },
  { id: "ana2", name: "Ana Silva" },
];

describe("findMentions", () => {
  it("matches full and first names, case-insensitively", () => {
    expect(findMentions("@rui can you check? cc @Daniel Hughes", people).sort()).toEqual(["daniel", "rui"]);
  });

  it("needs a word boundary on both sides", () => {
    expect(findMentions("email rui@example.com or @Ruiz", people)).toEqual([]);
  });

  it("only accepts ambiguous first names in full", () => {
    expect(findMentions("@Ana please", people)).toEqual([]);
    expect(findMentions("@Ana Silva please", people)).toEqual(["ana2"]);
  });

  it("handles accents and punctuation after the name", () => {
    expect(findMentions("Obrigado @João!", [{ id: "j", name: "João Pires" }])).toEqual(["j"]);
  });
});

describe("excerpt", () => {
  it("flattens whitespace and truncates", () => {
    expect(excerpt("a\n\n  b", 10)).toBe("a b");
    expect(excerpt("x".repeat(20), 10)).toBe(`${"x".repeat(9)}…`);
  });
});

describe("notification preferences", () => {
  it("falls back to defaults per channel", () => {
    expect(prefsOf(null, "MENTION")).toEqual({ email: true, push: true });
    expect(prefsOf({ MENTION: { email: false } }, "MENTION")).toEqual({ email: false, push: true });
    expect(prefsOf({ MENTION: { email: "yes" } }, "MENTION").email).toBe(true); // junk ignored
  });

  it("keeps chat messages out of the in-app list and email by default", () => {
    expect(NOTIFICATION_DEFAULTS.MESSAGE).toEqual({ inApp: false, email: false, push: true });
  });
});

describe("renderNotification", () => {
  const data = {
    number: 42,
    title: "Replace AP",
    actor: "Rui",
    status: "DONE",
    note: "",
    excerpt: "hello",
    where: "#42",
    place: "Villa QL7",
    detail: "Replace AP",
    asset: "UPS",
    meter: "Battery",
    value: 40,
    unit: "%",
    part: "PoE injector",
    qty: 2,
    vendor: "Redes Lusas",
    when: "05/11/2026, 14:30",
  };

  it.each(NOTIFICATION_TYPES.flatMap((t) => [["en", t] as const, ["pt", t] as const]))("renders %s %s", (locale, type) => {
    const r = renderNotification(locale, type, data);
    expect(r.title).not.toMatch(/[{}]|notify\./);
    expect(r.title.length).toBeGreaterThan(0);
  });

  it("uses the status to pick the wording", () => {
    expect(renderNotification("en", "WO_STATUS", { ...data, status: "ON_HOLD" }).title).toBe("Work order #42 is on hold");
    expect(renderNotification("pt", "REQUEST_UPDATE", { ...data, status: "DECLINED" }).title).toBe("O seu pedido R42 foi recusado");
    expect(renderNotification("en", "REQUEST_UPDATE", { ...data, status: "SCHEDULED", when: "05/11/2026, 14:30" }).title).toBe("Your request R42 was accepted: visit on 05/11/2026, 14:30");
    expect(renderNotification("pt", "REQUEST_UPDATE", { ...data, status: "RESCHEDULED", when: "05/11/2026, 14:30" }).title).toBe("A visita do seu pedido R42 passou para 05/11/2026, 14:30");
  });

  it("drops an empty body", () => {
    expect(renderNotification("en", "REQUEST_NEW", { ...data, place: "" }).body).toBeNull();
  });
});
