import type { LngLat, RoadSegment, DemandZone } from "./domain";

/**
 * Geographic model of Yaoundé, Cameroon.
 *
 * Coordinates are approximate positions of real districts and the corridors that
 * connect them — accurate enough to read as a real city on the map and to drive a
 * plausible simulation, without claiming survey precision.
 */

export const CITY_CENTER: LngLat = [11.5174, 3.8667];

/** Earth radius in metres, for the haversine distance below. */
const R = 6_371_000;

export function haversineM(a: LngLat, b: LngLat): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(a[0] - b[0]) * -1;
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function pathLengthM(path: LngLat[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += haversineM(path[i - 1], path[i]);
  return total;
}

interface RawCorridor {
  id: string;
  name: string;
  freeFlowKmh: number;
  path: LngLat[];
}

/**
 * Major Yaoundé corridors. Each is a directed polyline; the simulation also moves
 * taxis in reverse along the same geometry, so these double as two-way axes.
 */
const RAW_CORRIDORS: RawCorridor[] = [
  {
    id: "kennedy",
    name: "Avenue Kennedy",
    freeFlowKmh: 45,
    path: [
      [11.5174, 3.8667], // Poste Centrale
      [11.5128, 3.8694],
      [11.5060, 3.8730], // Carrefour Warda
      [11.5090, 3.8830], // Mokolo
    ],
  },
  {
    id: "vingtmai",
    name: "Boulevard du 20 Mai",
    freeFlowKmh: 50,
    path: [
      [11.5174, 3.8667], // Poste Centrale
      [11.517, 3.8744],
      [11.517, 3.882], // Nlongkak
      [11.5295, 3.8848],
      [11.541, 3.887], // Omnisport
    ],
  },
  {
    id: "bastos",
    name: "Route de Bastos",
    freeFlowKmh: 55,
    path: [
      [11.517, 3.882], // Nlongkak
      [11.508, 3.889], // Bastos
      [11.5155, 3.8965],
      [11.523, 3.904], // Etoudi
    ],
  },
  {
    id: "mvan-nsam",
    name: "Axe Mvan - Nsam",
    freeFlowKmh: 60,
    path: [
      [11.508, 3.819], // Mvan
      [11.514, 3.826],
      [11.518, 3.833], // Nsam
      [11.526, 3.852], // Mvog-Mbi
    ],
  },
  {
    id: "mvogmbi",
    name: "Avenue Mvog-Mbi",
    freeFlowKmh: 40,
    path: [
      [11.526, 3.852], // Mvog-Mbi
      [11.521, 3.859],
      [11.516, 3.866], // Marché Central
    ],
  },
  {
    id: "biyemassi",
    name: "Route de Biyem-Assi",
    freeFlowKmh: 50,
    path: [
      [11.496, 3.848], // Obili
      [11.479, 3.843], // Biyem-Assi
      [11.464, 3.833], // Mendong
    ],
  },
  {
    id: "ngoaekelle",
    name: "Axe Ngoa-Ekellé",
    freeFlowKmh: 45,
    path: [
      [11.501, 3.859], // Ngoa-Ekellé (université)
      [11.496, 3.848], // Obili
      [11.5025, 3.86],
      [11.506, 3.873], // Carrefour Warda area
    ],
  },
  {
    id: "essos",
    name: "Route d'Essos",
    freeFlowKmh: 50,
    path: [
      [11.516, 3.866], // Marché Central
      [11.526, 3.87],
      [11.536, 3.873], // Essos
      [11.547, 3.856], // Mimboman
    ],
  },
  {
    id: "ekounou",
    name: "Axe Ekounou",
    freeFlowKmh: 55,
    path: [
      [11.526, 3.852], // Mvog-Mbi
      [11.535, 3.843],
      [11.543, 3.833], // Ekounou
    ],
  },
  {
    id: "nsimeyong",
    name: "Axe Nsimeyong",
    freeFlowKmh: 45,
    path: [
      [11.516, 3.866], // Marché Central
      [11.509, 3.851],
      [11.501, 3.833], // Nsimeyong
    ],
  },
];

export const ROAD_SEGMENTS: RoadSegment[] = RAW_CORRIDORS.map((c) => ({
  ...c,
  lengthM: pathLengthM(c.path),
}));

/** Districts where passenger demand and taxi supply are measured. */
export const DEMAND_ZONES: Omit<DemandZone, "passengerDensity" | "taxiDensity" | "opportunityScore">[] = [
  { id: "poste", name: "Poste Centrale", lng: 11.5174, lat: 3.8667, radiusM: 650 },
  { id: "mokolo", name: "Marché Mokolo", lng: 11.509, lat: 3.883, radiusM: 700 },
  { id: "warda", name: "Carrefour Warda", lng: 11.506, lat: 3.873, radiusM: 550 },
  { id: "mvan", name: "Mvan", lng: 11.508, lat: 3.819, radiusM: 750 },
  { id: "nsam", name: "Nsam", lng: 11.518, lat: 3.833, radiusM: 600 },
  { id: "mvogmbi", name: "Mvog-Mbi", lng: 11.526, lat: 3.852, radiusM: 600 },
  { id: "biyemassi", name: "Biyem-Assi", lng: 11.479, lat: 3.843, radiusM: 800 },
  { id: "ngoaekelle", name: "Ngoa-Ekellé", lng: 11.501, lat: 3.859, radiusM: 600 },
  { id: "essos", name: "Essos", lng: 11.536, lat: 3.873, radiusM: 650 },
  { id: "omnisport", name: "Omnisport", lng: 11.541, lat: 3.887, radiusM: 700 },
  { id: "ekounou", name: "Ekounou", lng: 11.543, lat: 3.833, radiusM: 700 },
];

/** Adjacency between corridors that share an endpoint, used by the routing engine. */
export function buildAdjacency(segments: RoadSegment[]): Map<string, string[]> {
  const NEAR_M = 250;
  const endpoints = segments.map((s) => ({
    id: s.id,
    a: s.path[0],
    b: s.path[s.path.length - 1],
  }));
  const adj = new Map<string, string[]>();
  for (const s of endpoints) {
    const neighbours: string[] = [];
    for (const t of endpoints) {
      if (s.id === t.id) continue;
      const touches =
        haversineM(s.a, t.a) < NEAR_M ||
        haversineM(s.a, t.b) < NEAR_M ||
        haversineM(s.b, t.a) < NEAR_M ||
        haversineM(s.b, t.b) < NEAR_M;
      if (touches) neighbours.push(t.id);
    }
    adj.set(s.id, neighbours);
  }
  return adj;
}
