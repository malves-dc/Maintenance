// Picking a team on a work order (or when approving a request) fills in who is assigned. Pure, so it is unit-tested.

/**
 * Who should be assigned after the team changes from one with `prevMembers` to one with `nextMembers` (undefined =
 * no team). The people follow the team only while nobody touched them by hand: when nobody is assigned yet, or they
 * are exactly the previous team's members. Otherwise null: keep the people as they are.
 */
export function assigneesAfterTeamChange(
  current: ReadonlySet<string>,
  prevMembers: readonly string[] | undefined,
  nextMembers: readonly string[] | undefined,
): Set<string> | null {
  const untouched = current.size === 0 || (!!prevMembers && sameMembers(current, prevMembers));
  return untouched ? new Set(nextMembers ?? []) : null;
}

function sameMembers(a: ReadonlySet<string>, b: readonly string[]) {
  const bs = new Set(b);
  return a.size === bs.size && [...bs].every((id) => a.has(id));
}
