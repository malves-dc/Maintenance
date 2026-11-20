import { describe, expect, it } from "vitest";
import { exportSchema, importPlan, type DcHorasExport } from "@/lib/dc-horas-import";

const data: DcHorasExport = {
  format: "dc-horas-export",
  users: [
    { id: 1, name: "Ana", email: "Ana@Empresa.pt" },
    { id: 2, name: "Bruno", email: "bruno@empresa.pt" },
    { id: 3, name: "Sem registos", email: null },
  ],
  obras: [
    { id: 10, code: "vql-07", name: "Quinta do Lago" },
    { id: 11, code: "X1", name: "Villa Vale do Lobo 12" },
    { id: 12, code: "ZZ", name: "Desconhecida" },
  ],
  entries: [
    { id: 100, user_id: 1, obra_id: 10, date: "2026-11-02", start_time: "08:00", end_time: "12:00", minutes: 240, description: "Cabos", created_by: 1 },
    { id: 101, user_id: 1, obra_id: 11, date: "2026-11-03", start_time: null, end_time: null, minutes: 90, description: " Quadro ", created_by: 2 },
    { id: 102, user_id: 2, obra_id: 10, date: "2026-11-03", minutes: 60, description: "x" }, // Bruno has no account
    { id: 103, user_id: 1, obra_id: 12, date: "2026-11-03", minutes: 60, description: "x" }, // no villa
    { id: 104, user_id: 1, obra_id: 10, date: "2026-02-30", minutes: 60, description: "x" }, // bad day
    { id: 105, user_id: 1, obra_id: 10, date: "2026-11-02", start_time: "08:00", end_time: "12:00", minutes: 240, description: "Cabos" }, // same as 100
  ],
};
const members = [{ userId: "u-ana", email: "ana@empresa.pt" }, { userId: "u-carla", email: "carla@empresa.pt" }];
const villas = [
  { id: "v-vql", code: "VQL-07", name: "Villa Quinta do Lago 7" },
  { id: "v-vdl", code: "VDL-12", name: "Villa Vale do Lobo 12" },
];

describe("import from DC Horas", () => {
  it("matches people by e-mail and obras by code, else by name", () => {
    const p = importPlan(data, members, villas, []);
    expect(p.matchedUsers).toBe(1);
    expect(p.missingUsers).toEqual([{ name: "Bruno", email: "bruno@empresa.pt", entries: 1 }]);
    expect(p.matchedObras).toBe(2);
    expect(p.missingObras).toEqual([{ code: "ZZ", name: "Desconhecida", entries: 1 }]);
  });

  it("imports each entry once, tidied, and reports the rest", () => {
    const p = importPlan(data, members, villas, []);
    expect(p.toCreate).toEqual([
      { userId: "u-ana", villaId: "v-vql", date: "2026-11-02", startTime: "08:00", endTime: "12:00", minutes: 240, description: "Cabos", createdById: "u-ana" },
      { userId: "u-ana", villaId: "v-vdl", date: "2026-11-03", startTime: null, endTime: null, minutes: 90, description: "Quadro", createdById: "u-ana" },
    ]);
    expect(p.duplicates).toBe(1);
    expect(p.skippedUnmatched).toBe(2);
    expect(p.invalid).toBe(1);
  });

  it("skips what was imported before", () => {
    const first = importPlan(data, members, villas, []);
    const again = importPlan(data, members, villas, first.toCreate);
    expect(again.toCreate).toEqual([]);
    expect(again.duplicates).toBe(3);
  });

  it("only accepts a DC Horas export", () => {
    expect(exportSchema.safeParse({ users: [], obras: [], entries: [] }).success).toBe(false);
    expect(exportSchema.safeParse(data).success).toBe(true);
  });
});
