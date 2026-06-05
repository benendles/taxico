"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { useTheme } from "next-themes";
import type { Corridor, DemandZone, LngLat, SegmentTraffic, Taxi } from "@/lib/types";
import { BRAND, TRAFFIC_COLOR } from "@/lib/ui";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const CENTER: LngLat = [11.5174, 3.8667];

const STATUS_COLOR: Record<Taxi["status"], string> = {
  cruising: BRAND,
  occupied: "#6B6B6B",
  idle: "#22C55E",
};

const styleFor = (theme?: string) =>
  theme === "light" ? "mapbox://styles/mapbox/light-v11" : "mapbox://styles/mapbox/dark-v11";

export interface CityMapProps {
  corridors: Corridor[];
  traffic: SegmentTraffic[];
  taxis: Taxi[];
  zones: DemandZone[];
  routePath?: LngLat[];
  origin?: LngLat | null;
  destination?: LngLat | null;
  showTaxis?: boolean;
  showZones?: boolean;
}

function corridorFeatures(corridors: Corridor[], traffic: SegmentTraffic[]) {
  const levelById = new Map(traffic.map((t) => [t.segmentId, t.level]));
  return corridors.map((c) => ({
    type: "Feature" as const,
    properties: { color: TRAFFIC_COLOR[levelById.get(c.id) ?? "free"] },
    geometry: { type: "LineString" as const, coordinates: c.path },
  }));
}

function taxiFeatures(taxis: Taxi[]) {
  return taxis.map((t) => ({
    type: "Feature" as const,
    properties: { color: STATUS_COLOR[t.status] },
    geometry: { type: "Point" as const, coordinates: [t.lng, t.lat] },
  }));
}

function zoneFeatures(zones: DemandZone[]) {
  const max = Math.max(1, ...zones.map((z) => z.opportunityScore));
  return zones.map((z) => ({
    type: "Feature" as const,
    properties: {
      intensity: z.opportunityScore / max,
      name: z.name,
      passengers: z.passengerDensity,
      taxis: z.taxiDensity,
      score: z.opportunityScore,
    },
    geometry: { type: "Point" as const, coordinates: [z.lng, z.lat] },
  }));
}

function fc(features: GeoJSON.Feature[]): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features };
}

export default function CityMap(props: CityMapProps) {
  if (!TOKEN) return <SchematicMap {...props} />;
  return <MapboxMap {...props} />;
}

function MapboxMap({
  corridors,
  traffic,
  taxis,
  zones,
  routePath,
  origin,
  destination,
  showTaxis = true,
  showZones = true,
}: CityMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const styleTheme = useRef<string | undefined>(undefined);
  const { resolvedTheme } = useTheme();

  // Layer setup is reused on first load and after every theme-driven style swap.
  function installLayers(m: mapboxgl.Map) {
    if (!m.getSource("corridors")) {
      m.addSource("corridors", { type: "geojson", data: fc([]) });
      m.addLayer({
        id: "corridors",
        type: "line",
        source: "corridors",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": ["get", "color"], "line-width": 4, "line-opacity": 0.85, "line-blur": 0.3 },
      });
    }
    if (!m.getSource("route")) {
      m.addSource("route", { type: "geojson", data: fc([]) });
      m.addLayer({
        id: "route-glow",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": BRAND, "line-width": 11, "line-opacity": 0.16, "line-blur": 3 },
      });
      m.addLayer({
        id: "route",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": BRAND, "line-width": 3.5 },
      });
    }
    if (!m.getSource("zones")) {
      m.addSource("zones", { type: "geojson", data: fc([]) });
      m.addLayer({
        id: "zones",
        type: "circle",
        source: "zones",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["get", "intensity"], 0, 10, 1, 32],
          "circle-color": BRAND,
          "circle-opacity": ["interpolate", ["linear"], ["get", "intensity"], 0, 0.05, 1, 0.2],
          "circle-stroke-color": BRAND,
          "circle-stroke-width": 1,
          "circle-stroke-opacity": 0.35,
        },
      });
      m.on("click", "zones", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as { name: string; passengers: number; taxis: number; score: number };
        new mapboxgl.Popup({ closeButton: false, offset: 14 })
          .setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number])
          .setHTML(
            `<div style="font-family:var(--font-mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase;opacity:.6">${p.name}</div>
             <div style="margin-top:6px;font-size:13px">${p.passengers} passengers / ${p.taxis} taxis</div>
             <div style="margin-top:2px;color:${BRAND};font-weight:600">Opportunity ${p.score}</div>`,
          )
          .addTo(m);
      });
      m.on("mouseenter", "zones", () => (m.getCanvas().style.cursor = "pointer"));
      m.on("mouseleave", "zones", () => (m.getCanvas().style.cursor = ""));
    }
    if (!m.getSource("taxis")) {
      m.addSource("taxis", { type: "geojson", data: fc([]) });
      m.addLayer({
        id: "taxis",
        type: "circle",
        source: "taxis",
        paint: {
          "circle-radius": 3.6,
          "circle-color": ["get", "color"],
          "circle-stroke-color": "rgba(0,0,0,0.35)",
          "circle-stroke-width": 0.6,
        },
      });
    }
  }

  // Create the map once.
  useEffect(() => {
    if (!container.current || map.current) return;
    mapboxgl.accessToken = TOKEN as string;
    const m = new mapboxgl.Map({
      container: container.current,
      style: styleFor(resolvedTheme),
      center: CENTER,
      zoom: 12.2,
      attributionControl: false,
    });
    m.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");
    styleTheme.current = resolvedTheme === "light" ? "light" : "dark";
    m.on("load", () => {
      installLayers(m);
      setReady(true);
    });
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swap the base style when the theme changes, then reinstall layers + data.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const wanted = resolvedTheme === "light" ? "light" : "dark";
    if (styleTheme.current === wanted) return;
    styleTheme.current = wanted;
    setReady(false);
    m.setStyle(styleFor(resolvedTheme));
    m.once("style.load", () => {
      installLayers(m);
      setReady(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedTheme]);

  useEffect(() => {
    if (!ready || !map.current) return;
    (map.current.getSource("corridors") as mapboxgl.GeoJSONSource | undefined)?.setData(fc(corridorFeatures(corridors, traffic)));
  }, [ready, corridors, traffic]);

  useEffect(() => {
    if (!ready || !map.current) return;
    (map.current.getSource("taxis") as mapboxgl.GeoJSONSource | undefined)?.setData(fc(showTaxis ? taxiFeatures(taxis) : []));
  }, [ready, taxis, showTaxis]);

  useEffect(() => {
    if (!ready || !map.current) return;
    (map.current.getSource("zones") as mapboxgl.GeoJSONSource | undefined)?.setData(fc(showZones ? zoneFeatures(zones) : []));
  }, [ready, zones, showZones]);

  useEffect(() => {
    if (!ready || !map.current) return;
    const data: GeoJSON.Feature[] = routePath?.length
      ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: routePath } }]
      : [];
    (map.current.getSource("route") as mapboxgl.GeoJSONSource | undefined)?.setData(fc(data));
    if (routePath?.length) {
      const bounds = routePath.reduce(
        (b, p) => b.extend(p as [number, number]),
        new mapboxgl.LngLatBounds(routePath[0] as [number, number], routePath[0] as [number, number]),
      );
      map.current.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 700 });
    }
  }, [ready, routePath]);

  useEffect(() => {
    if (!ready || !map.current) return;
    markers.current.forEach((mk) => mk.remove());
    markers.current = [];
    const add = (pos: LngLat, color: string, label: string) => {
      const el = document.createElement("div");
      el.style.cssText = `width:15px;height:15px;border-radius:50%;background:${color};border:3px solid rgba(255,255,255,0.9);box-shadow:0 0 0 1.5px ${color}`;
      el.title = label;
      markers.current.push(new mapboxgl.Marker({ element: el }).setLngLat(pos).addTo(map.current!));
    };
    if (origin) add(origin, "#22C55E", "Origin");
    if (destination) add(destination, "#EF4444", "Destination");
  }, [ready, origin, destination]);

  return <div ref={container} className="h-full w-full" />;
}

/** Token-free fallback: projects the same live data into an SVG schematic. */
function SchematicMap({ corridors, traffic, taxis, zones, routePath, origin, destination, showTaxis = true, showZones = true }: CityMapProps) {
  const W = 1000;
  const H = 640;
  const PAD = 60;

  const project = useMemo(() => {
    const pts = corridors.flatMap((c) => c.path);
    const lngs = pts.map((p) => p[0]);
    const lats = pts.map((p) => p[1]);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    return (p: LngLat): [number, number] => {
      const x = PAD + ((p[0] - minLng) / (maxLng - minLng || 1)) * (W - 2 * PAD);
      const y = PAD + (1 - (p[1] - minLat) / (maxLat - minLat || 1)) * (H - 2 * PAD);
      return [x, y];
    };
  }, [corridors]);

  const levelById = new Map(traffic.map((t) => [t.segmentId, t.level]));
  const maxOpp = Math.max(1, ...zones.map((z) => z.opportunityScore));

  return (
    <div className="relative h-full w-full overflow-hidden">
      <svg viewBox={`0 0 ${W} ${H}`} className="hairline-grid h-full w-full [background-size:32px_32px]" preserveAspectRatio="xMidYMid slice">
        {showZones &&
          zones.map((z) => {
            const [x, y] = project([z.lng, z.lat]);
            const r = 10 + (z.opportunityScore / maxOpp) * 32;
            return <circle key={z.id} cx={x} cy={y} r={r} fill={BRAND} fillOpacity={0.05 + (z.opportunityScore / maxOpp) * 0.16} stroke={BRAND} strokeOpacity={0.3} />;
          })}
        {corridors.map((c) => {
          const d = c.path.map(project).map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
          return <path key={c.id} d={d} fill="none" stroke={TRAFFIC_COLOR[levelById.get(c.id) ?? "free"]} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />;
        })}
        {routePath?.length ? (
          <path d={routePath.map(project).map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ")} fill="none" stroke={BRAND} strokeWidth={3.5} strokeDasharray="2 7" strokeLinecap="round" />
        ) : null}
        {showTaxis &&
          taxis.map((t) => {
            const [x, y] = project([t.lng, t.lat]);
            return <circle key={t.id} cx={x} cy={y} r={3} fill={STATUS_COLOR[t.status]} stroke="rgba(0,0,0,0.3)" strokeWidth={0.6} />;
          })}
        {origin && <EndpointDot p={project(origin)} color="#22C55E" />}
        {destination && <EndpointDot p={project(destination)} color="#EF4444" />}
      </svg>
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg border border-hairline bg-surface/85 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-faint">
        Schematic view. Add NEXT_PUBLIC_MAPBOX_TOKEN for live tiles
      </div>
    </div>
  );
}

function EndpointDot({ p, color }: { p: [number, number]; color: string }) {
  return (
    <g>
      <circle cx={p[0]} cy={p[1]} r={9} fill="none" stroke={color} strokeOpacity={0.5}>
        <animate attributeName="r" values="9;20;9" dur="2.4s" repeatCount="indefinite" />
        <animate attributeName="stroke-opacity" values="0.6;0;0.6" dur="2.4s" repeatCount="indefinite" />
      </circle>
      <circle cx={p[0]} cy={p[1]} r={6} fill={color} stroke="rgba(255,255,255,0.9)" strokeWidth={2} />
    </g>
  );
}
