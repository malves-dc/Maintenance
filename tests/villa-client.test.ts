import { describe, expect, it } from "vitest";
import { normalizeBillTo, villaClient, villaClientIds } from "@/lib/villa-client";

const owner = { id: "o", name: "Owner" };
const manager = { id: "m", name: "Manager" };

describe("villaClient", () => {
  it("bills the owner by default", () => {
    expect(villaClient({ client: owner, manager, billTo: "OWNER" })).toBe(owner);
  });
  it("bills the manager when chosen", () => {
    expect(villaClient({ client: owner, manager, billTo: "MANAGER" })).toBe(manager);
  });
  it("falls back to whichever side the villa has", () => {
    expect(villaClient({ client: null, manager, billTo: "OWNER" })).toBe(manager);
    expect(villaClient({ client: owner, manager: null, billTo: "MANAGER" })).toBe(owner);
  });
});

describe("normalizeBillTo", () => {
  it("keeps the choice only when there are both", () => {
    expect(normalizeBillTo({ clientId: "o", managerId: "m", billTo: "MANAGER" })).toBe("MANAGER");
    expect(normalizeBillTo({ clientId: null, managerId: "m", billTo: "OWNER" })).toBe("MANAGER");
    expect(normalizeBillTo({ clientId: "o", managerId: null, billTo: "MANAGER" })).toBe("OWNER");
  });
});

describe("villaClientIds", () => {
  it("lists owner and/or manager", () => {
    expect(villaClientIds({ clientId: "o", managerId: "m" })).toEqual(["o", "m"]);
    expect(villaClientIds({ clientId: null, managerId: "m" })).toEqual(["m"]);
    expect(villaClientIds({ clientId: "o", managerId: null })).toEqual(["o"]);
  });
});
