import { describe, expect, it } from "vitest";
import { estimateKm, hasCoordinates, osrmKm, osrmTableUrl, parseLatLng, ROAD_FACTOR, roundKm, straightKm } from "@/lib/geo";

const faro = { latitude: 37.0194, longitude: -7.9304 };
const lagos = { latitude: 37.1028, longitude: -8.6742 };

describe("distances from coordinates", () => {
  it("measures the straight line (haversine)", () => {
    expect(straightKm(faro, faro)).toBe(0);
    // Faro → Lagos is about 66.6 km as the crow flies.
    expect(straightKm(faro, lagos)).toBeGreaterThan(66);
    expect(straightKm(faro, lagos)).toBeLessThan(67);
    // One degree of latitude ≈ 111.2 km.
    expect(roundKm(straightKm({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 }))).toBe(111.2);
  });

  it("estimates the road as the straight line × the road factor, to 0.1 km", () => {
    expect(ROAD_FACTOR).toBe(1.3);
    expect(estimateKm(faro, lagos)).toBe(roundKm(straightKm(faro, lagos) * 1.3));
    expect(String(estimateKm(faro, lagos))).toMatch(/^\d+(\.\d)?$/);
  });

  it("needs both coordinates, within range", () => {
    expect(hasCoordinates(faro)).toBe(true);
    expect(hasCoordinates({ latitude: 37, longitude: null })).toBe(false);
    expect(hasCoordinates({ latitude: 95, longitude: 0 })).toBe(false);
    expect(hasCoordinates(null)).toBe(false);
  });

  it("reads coordinates copied from a map", () => {
    expect(parseLatLng("37.0194, -7.9304")).toEqual(faro);
    expect(parseLatLng("37.0194 -7.9304")).toEqual(faro);
    expect(parseLatLng("Faro")).toBeNull();
    expect(parseLatLng("91, 0")).toBeNull();
  });
});

describe("OSRM", () => {
  it("sends only rounded coordinates, longitude first, from the first place to the others", () => {
    const url = osrmTableUrl("https://router.example/", faro, [lagos]);
    expect(url).toBe("https://router.example/table/v1/driving/-7.9304,37.0194;-8.6742,37.1028?sources=0&annotations=distance");
    expect(osrmTableUrl("https://r.example", { latitude: 37.123456, longitude: -8.987654 }, [])).toContain("-8.9877,37.1235");
  });

  it("reads the road km per destination, null where there is no route", () => {
    expect(osrmKm({ code: "Ok", distances: [[0, 83456.7, null]] }, 2)).toEqual([83.5, null]);
    expect(() => osrmKm({ code: "InvalidQuery" }, 1)).toThrow();
    expect(() => osrmKm(null, 1)).toThrow();
  });
});
