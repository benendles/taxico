import { describe, it, expect } from "vitest";
import {
  haversineM,
  pathLengthM,
  buildAdjacency,
  ROAD_SEGMENTS,
  DEMAND_ZONES,
  CITY_CENTER,
} from "../src/geo";
import type { LngLat } from "../src/domain";

describe("haversineM", () => {
  it("returns 0 for identical points", () => {
    expect(haversineM(CITY_CENTER, CITY_CENTER)).toBe(0);
  });

  it("approximates 111 km for one degree of latitude", () => {
    const d = haversineM([11, 3], [11, 4]);
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });

  it("is symmetric (distance A->B equals B->A)", () => {
    const a: LngLat = [11.5174, 3.8667];
    const b: LngLat = [11.506, 3.873];
    expect(haversineM(a, b)).toBeCloseTo(haversineM(b, a), 6);
  });

  it("returns a positive distance for distinct points", () => {
    expect(haversineM([11.5174, 3.8667], [11.506, 3.873])).toBeGreaterThan(0);
  });
});

describe("pathLengthM", () => {
  it("returns 0 for a single-point path", () => {
    expect(pathLengthM([[11.5174, 3.8667]])).toBe(0);
  });

  it("returns 0 for an empty path", () => {
    expect(pathLengthM([])).toBe(0);
  });

  it("sums the segments of a multi-point path", () => {
    const path: LngLat[] = [
      [11.5174, 3.8667],
      [11.5128, 3.8694],
      [11.506, 3.873],
    ];
    const expected =
      haversineM(path[0], path[1]) + haversineM(path[1], path[2]);
    expect(pathLengthM(path)).toBeCloseTo(expected, 6);
  });
});

describe("ROAD_SEGMENTS", () => {
  it("derives a positive lengthM for every corridor", () => {
    expect(ROAD_SEGMENTS.length).toBeGreaterThan(0);
    for (const seg of ROAD_SEGMENTS) {
      expect(seg.lengthM).toBeGreaterThan(0);
      expect(seg.path.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("buildAdjacency", () => {
  it("creates an entry for every segment", () => {
    const adj = buildAdjacency(ROAD_SEGMENTS);
    for (const seg of ROAD_SEGMENTS) {
      expect(adj.has(seg.id)).toBe(true);
    }
  });

  it("never lists a segment as its own neighbour", () => {
    const adj = buildAdjacency(ROAD_SEGMENTS);
    for (const [id, neighbours] of adj) {
      expect(neighbours).not.toContain(id);
    }
  });

  it("produces symmetric adjacency for touching corridors", () => {
    const adj = buildAdjacency(ROAD_SEGMENTS);
    for (const [id, neighbours] of adj) {
      for (const n of neighbours) {
        expect(adj.get(n)).toContain(id);
      }
    }
  });
});

describe("DEMAND_ZONES", () => {
  it("defines zones with a positive radius", () => {
    expect(DEMAND_ZONES.length).toBeGreaterThan(0);
    for (const z of DEMAND_ZONES) {
      expect(z.radiusM).toBeGreaterThan(0);
    }
  });
});
