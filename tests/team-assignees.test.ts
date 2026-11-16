import { describe, expect, it } from "vitest";
import { assigneesAfterTeamChange } from "@/lib/team-assignees";

const cctv = ["luis"];
const network = ["andre", "davide", "marcos"];
const ids = (s: Set<string> | null) => (s ? [...s].sort() : null);

describe("assignees when the team changes", () => {
  it("fills in the team's members when nobody is assigned yet", () => {
    expect(ids(assigneesAfterTeamChange(new Set(), undefined, network))).toEqual(["andre", "davide", "marcos"]);
  });

  it("swaps them for the new team's members while they are still the previous team's", () => {
    expect(ids(assigneesAfterTeamChange(new Set(network), network, cctv))).toEqual(["luis"]);
    // Same people in another order is still untouched.
    expect(ids(assigneesAfterTeamChange(new Set(["marcos", "andre", "davide"]), network, cctv))).toEqual(["luis"]);
  });

  it("clears them when the team is removed, if they were the team's", () => {
    expect(ids(assigneesAfterTeamChange(new Set(cctv), cctv, undefined))).toEqual([]);
  });

  it("keeps people chosen or changed by hand", () => {
    // Someone added by hand to the team's members.
    expect(assigneesAfterTeamChange(new Set([...network, "luis"]), network, cctv)).toBeNull();
    // Someone removed from the team's members.
    expect(assigneesAfterTeamChange(new Set(["andre"]), network, cctv)).toBeNull();
    // People picked before any team.
    expect(assigneesAfterTeamChange(new Set(["joao"]), undefined, cctv)).toBeNull();
  });
});
