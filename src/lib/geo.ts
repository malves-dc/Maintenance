// Distances between villas and offices (Settings → Offices), from their coordinates. Without a routing server the
// distance is an estimate: the straight line × a road factor. With one (OSRM, see lib/offices.ts) it is the
// shortest road distance. Pure helpers, shared by the server and the tests.

export type Point = { latitude: number | null; longitude: number | null };
export type LatLng = { latitude: number; longitude: number };

/** Roads are rarely straight: on average a road trip is about 1.3 × the straight line (rural Portugal, Algarve). */
export const ROAD_FACTOR = 1.3;

export const hasCoordinates = (p: Point | null | undefined): p is LatLng =>
  p?.latitude != null && p.longitude != null && Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180;

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in km (haversine). */
export function straightKm(a: LatLng, b: LatLng) {
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Distances are kept to 0.1 km. */
export const roundKm = (km: number) => Math.round(km * 10) / 10;

/** The estimated road distance in km: the straight line × the road factor. */
export const estimateKm = (a: LatLng, b: LatLng) => roundKm(straightKm(a, b) * ROAD_FACTOR);

/** "38.7223, -9.1393" (as copied from a map) → coordinates; null when it isn't a pair of valid numbers. */
export function parseLatLng(text: string | null | undefined): LatLng | null {
  const m = text?.trim().match(/^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const p = { latitude: Number(m[1]), longitude: Number(m[2]) };
  return hasCoordinates(p) ? p : null;
}

/**
 * The OSRM table request for the road distances from one place to several (coordinates only, longitude first,
 * rounded to ~10 m: no names or addresses leave the server).
 */
export function osrmTableUrl(base: string, from: LatLng, to: LatLng[]) {
  const c = (p: LatLng) => `${p.longitude.toFixed(4)},${p.latitude.toFixed(4)}`;
  return `${base.replace(/\/+$/, "")}/table/v1/driving/${[from, ...to].map(c).join(";")}?sources=0&annotations=distance`;
}

/** Road km per destination from an OSRM table answer (null where there is no route). */
export function osrmKm(body: unknown, count: number): (number | null)[] {
  const row = (body as { code?: string; distances?: (number | null)[][] })?.distances?.[0];
  if ((body as { code?: string })?.code !== "Ok" || !Array.isArray(row)) throw new Error("osrm");
  return Array.from({ length: count }, (_, i) => {
    const m = row[i + 1];
    return typeof m === "number" && Number.isFinite(m) ? roundKm(m / 1000) : null;
  });
}
