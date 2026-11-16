import "server-only";
import type { TenantDb } from "@/lib/db/tenant";
import { estimateKm, hasCoordinates, osrmKm, osrmTableUrl, type LatLng } from "@/lib/geo";
import type { HomeOffices } from "@/lib/travel-charge";

// Offices (Settings → Offices): where technicians leave from. Each villa has a default office, each technician one
// or more offices (one of them primary), and the distance from every office to every villa is kept in
// VillaOfficeDistance: typed by hand (MANUAL, never replaced), or worked out from the coordinates, as a straight-line
// estimate or, when the company turns it on, by road with OSRM. Only coordinates are sent to OSRM, never names or
// addresses. See lib/travel-charge.ts for how trips use them.

/** The routing server: the public OSRM demo by default, or your own (OSRM_URL). */
export const osrmBase = () => process.env.OSRM_URL || "https://router.project-osrm.org";
const OSRM_TIMEOUT_MS = 10_000;
const OSRM_CHUNK = 50; // destinations per request (the public server takes up to 100 coordinates)

/** Everyone's primary office: the one marked primary, else their only (or first) office. */
export async function homeOffices(db: TenantDb): Promise<HomeOffices> {
  const rows = await db.officeMember.findMany({ select: { userId: true, officeId: true, primary: true }, orderBy: [{ primary: "desc" }, { office: { name: "asc" } }] });
  const homes = new Map<string, string>();
  for (const r of rows) if (!homes.has(r.userId)) homes.set(r.userId, r.officeId);
  return homes;
}

/** Road km from one place to several with OSRM (null where it has no route). Throws when the server can't be reached. */
export async function roadKm(from: LatLng, to: LatLng[]): Promise<(number | null)[]> {
  const out: (number | null)[] = [];
  for (let i = 0; i < to.length; i += OSRM_CHUNK) {
    const part = to.slice(i, i + OSRM_CHUNK);
    const res = await fetch(osrmTableUrl(osrmBase(), from, part), { signal: AbortSignal.timeout(OSRM_TIMEOUT_MS), headers: { "User-Agent": "VillaOps-CMMS" } });
    if (!res.ok) throw new Error(`osrm ${res.status}`);
    out.push(...osrmKm(await res.json(), part.length));
  }
  return out;
}

export type RefreshResult = { road: number; estimated: number; cleared: number; failed: boolean };

type Place = { id: string; latitude: number | null; longitude: number | null };

/**
 * Works out the distances that aren't typed by hand, for the given villas and/or offices (all when omitted): by road
 * when `road` is on (falling back to the estimate if the routing server fails), else the estimate. A pair where one
 * side has no coordinates loses its worked-out distance.
 */
export async function refreshDistances(
  db: TenantDb,
  organizationId: string,
  opts: { road: boolean; villaIds?: string[]; officeIds?: string[] },
): Promise<RefreshResult> {
  const [offices, villas, manual] = await Promise.all([
    db.office.findMany({ where: opts.officeIds ? { id: { in: opts.officeIds } } : {}, select: { id: true, latitude: true, longitude: true } }),
    db.villa.findMany({ where: { archivedAt: null, ...(opts.villaIds ? { id: { in: opts.villaIds } } : {}) }, select: { id: true, latitude: true, longitude: true } }),
    db.villaOfficeDistance.findMany({
      where: { source: "MANUAL", ...(opts.villaIds ? { villaId: { in: opts.villaIds } } : {}), ...(opts.officeIds ? { officeId: { in: opts.officeIds } } : {}) },
      select: { villaId: true, officeId: true },
    }),
  ]);
  const typed = new Set(manual.map((m) => `${m.villaId}|${m.officeId}`));
  const result: RefreshResult = { road: 0, estimated: 0, cleared: 0, failed: false };

  for (const office of offices) {
    const targets = villas.filter((v) => !typed.has(`${v.id}|${office.id}`));
    const located = hasCoordinates(office) ? targets.filter((v): v is Place & LatLng => hasCoordinates(v)) : [];
    const unlocated = targets.filter((v) => !located.includes(v as Place & LatLng)).map((v) => v.id);
    if (unlocated.length) {
      const { count } = await db.villaOfficeDistance.deleteMany({ where: { officeId: office.id, villaId: { in: unlocated }, source: { not: "MANUAL" } } });
      result.cleared += count;
    }
    if (!located.length || !hasCoordinates(office)) continue;

    let road: (number | null)[] | null = null;
    if (opts.road) {
      try {
        road = await roadKm(office, located);
      } catch {
        result.failed = true;
      }
    }
    for (const [i, v] of located.entries()) {
      const byRoad = road?.[i] ?? null;
      const km = byRoad ?? estimateKm(office, v);
      const source = byRoad != null ? "ROAD" : "ESTIMATE";
      if (source === "ROAD") result.road += 1;
      else result.estimated += 1;
      await db.villaOfficeDistance.upsert({
        where: { villaId_officeId: { villaId: v.id, officeId: office.id } },
        create: { organizationId, villaId: v.id, officeId: office.id, distanceKm: km, source },
        update: { distanceKm: km, source },
      });
    }
  }
  return result;
}

/** Types a distance by hand (kept until cleared), or clears it (null) so it is worked out again. */
export async function setManualDistance(db: TenantDb, organizationId: string, villaId: string, officeId: string, km: number | null) {
  if (km == null) {
    await db.villaOfficeDistance.deleteMany({ where: { villaId, officeId, source: "MANUAL" } });
    return;
  }
  await db.villaOfficeDistance.upsert({
    where: { villaId_officeId: { villaId, officeId } },
    create: { organizationId, villaId, officeId, distanceKm: km, source: "MANUAL" },
    update: { distanceKm: km, source: "MANUAL" },
  });
}

/**
 * The company's first office takes over what it had before offices: the villas' distances (typed by hand, from the
 * company's address) become this office's, and it becomes every villa's default office.
 */
export async function adoptFirstOffice(db: TenantDb, organizationId: string, officeId: string) {
  const villas = await db.villa.findMany({ select: { id: true, distanceKm: true, defaultOfficeId: true } });
  const withKm = villas.filter((v) => v.distanceKm != null);
  if (withKm.length) {
    await db.villaOfficeDistance.createMany({
      data: withKm.map((v) => ({ organizationId, villaId: v.id, officeId, distanceKm: v.distanceKm!, source: "MANUAL" as const })),
      skipDuplicates: true,
    });
  }
  await db.villa.updateMany({ where: { defaultOfficeId: null }, data: { defaultOfficeId: officeId } });
}

export type VillaOffice = { id: string; name: string; km: number | null; source: "MANUAL" | "ESTIMATE" | "ROAD" | null };

/** The company's offices with their distance to this villa (none yet for a new villa), for the villa's form and page. */
export async function villaOffices(db: TenantDb, villaId: string | null): Promise<VillaOffice[]> {
  const offices = await db.office.findMany({
    select: { id: true, name: true, distances: villaId ? { where: { villaId }, select: { distanceKm: true, source: true } } : false },
    orderBy: { name: "asc" },
  });
  return offices.map((o) => {
    const d = (o as { distances?: { distanceKm: number; source: VillaOffice["source"] }[] }).distances?.[0];
    return { id: o.id, name: o.name, km: d?.distanceKm ?? null, source: d?.source ?? null };
  });
}
