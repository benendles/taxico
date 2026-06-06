"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { useTheme } from "next-themes";
import type { Corridor, DemandZone, LngLat, SegmentTraffic, Taxi, TrafficLevel } from "@/lib/types";
import { BRAND, TRAFFIC_COLOR, TRAFFIC_LABEL } from "@/lib/ui";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const CENTER: LngLat = [11.5174, 3.8667];

const STATUS_COLOR: Record<Taxi["status"], string> = {
  cruising: BRAND,
  occupied: "#6B6B6B",
  idle: "#22C55E",
};

const styleFor = (theme?: string) =>
  theme === "light"
    ? "mapbox://styles/mapbox/navigation-day-v1"
    : "mapbox://styles/mapbox/navigation-night-v1";

/** Returns an Uber-style colour interpolated from green (cold) to red (hot). */
function surgeColor(intensity: number): string {
  if (intensity < 0.35) return "#22C55E";
  if (intensity < 0.55) return "#84CC16";
  if (intensity < 0.70) return "#EAB308";
  if (intensity < 0.85) return "#F97316";
  return "#EF4444";
}

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
  /** Driver's current position — renders an animated car marker when set. */
  driverLocation?: LngLat | null;
  /** Heading in degrees (0 = north, clockwise). Rotates the car icon. */
  driverHeading?: number;
}

// ── Feature helpers ──────────────────────────────────────────────────────────

function corridorFeatures(corridors: Corridor[], traffic: SegmentTraffic[]) {
  const trafficById = new Map(traffic.map((t) => [t.segmentId, t]));
  return corridors.map((c) => {
    const t = trafficById.get(c.id);
    const level = t?.level ?? "free";
    return {
      type: "Feature" as const,
      properties: {
        color: TRAFFIC_COLOR[level],
        level,
        name: c.name,
        speed: t?.avgSpeedKmh ?? 50,
        congestion: t?.congestionScore ?? 0.1,
      },
      geometry: { type: "LineString" as const, coordinates: c.path },
    };
  });
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

// ── Driver car marker ────────────────────────────────────────────────────────

function createDriverEl(): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = "width:48px;height:48px;pointer-events:none;position:relative;";
  el.innerHTML = `
    <div class="driver-pulse-ring"></div>
    <div id="driver-inner" style="width:48px;height:48px;transition:transform 0.35s ease;">
      <svg viewBox="0 0 48 48" width="48" height="48" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="24" cy="43" rx="12" ry="3" fill="rgba(0,0,0,0.18)"/>
        <rect x="13" y="10" width="22" height="30" rx="8" fill="#1A56DB"/>
        <path d="M16 14 L32 14 L31 21 L17 21 Z" fill="rgba(180,220,255,0.8)"/>
        <rect x="17" y="28" width="14" height="7" rx="2" fill="rgba(180,220,255,0.55)"/>
        <circle cx="17.5" cy="11.5" r="2.5" fill="#FDE68A" opacity="0.95"/>
        <circle cx="30.5" cy="11.5" r="2.5" fill="#FDE68A" opacity="0.95"/>
        <circle cx="18" cy="37" r="2" fill="#FCA5A5" opacity="0.9"/>
        <circle cx="30" cy="37" r="2" fill="#FCA5A5" opacity="0.9"/>
        <circle cx="24" cy="8" r="3.5" fill="#22C55E" stroke="white" stroke-width="1.5"/>
      </svg>
    </div>`;
  return el;
}

// ── Main export ──────────────────────────────────────────────────────────────

export default function CityMap(props: CityMapProps) {
  if (!TOKEN) return <SchematicMap {...props} />;
  return <MapboxMap {...props} />;
}

// ── Mapbox implementation ────────────────────────────────────────────────────

function MapboxMap({
  corridors, traffic, taxis, zones,
  routePath, origin, destination,
  showTaxis = true, showZones = true,
  driverLocation, driverHeading = 0,
}: CityMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const driverMarker = useRef<mapboxgl.Marker | null>(null);
  const styleTheme = useRef<string | undefined>(undefined);
  const { resolvedTheme } = useTheme();

  function installLayers(m: mapboxgl.Map) {
    const haloColor = styleTheme.current === "light" ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,0.75)";

    // ── Corridors ─────────────────────────────────────────────────────────
    if (!m.getSource("corridors")) {
      m.addSource("corridors", { type: "geojson", data: fc([]) });

      // Base corridor line, width scales with congestion level
      m.addLayer({
        id: "corridors",
        type: "line",
        source: "corridors",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ["get", "color"],
          "line-width": [
            "interpolate", ["linear"], ["get", "congestion"],
            0, 3.5, 0.3, 4.5, 0.55, 6.5, 0.78, 8, 1, 10,
          ],
          "line-opacity": 0.9,
          "line-blur": 0.25,
        },
      });

      // Click popup: traffic info for the tapped corridor
      m.on("click", "corridors", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as { color: string; level: TrafficLevel; name: string; speed: number; congestion: number };
        new mapboxgl.Popup({ closeButton: false, offset: 10, maxWidth: "220px" })
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font-family:var(--font-mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;opacity:.55">${p.name}</div>
             <div style="margin-top:5px;display:flex;align-items:center;gap:7px">
               <span style="width:9px;height:9px;border-radius:50%;background:${p.color};flex-shrink:0"></span>
               <span style="font-size:14px;font-weight:700;color:${p.color}">${TRAFFIC_LABEL[p.level]}</span>
             </div>
             <div style="margin-top:5px;font-size:12px">Avg speed: <strong>${p.speed} km/h</strong></div>
             <div style="margin-top:2px;font-size:11px;opacity:.6">Congestion ${Math.round(p.congestion * 100)}%</div>`,
          )
          .addTo(m);
      });
      m.on("mouseenter", "corridors", () => (m.getCanvas().style.cursor = "pointer"));
      m.on("mouseleave", "corridors", () => (m.getCanvas().style.cursor = ""));
    }

    // ── Planned route ─────────────────────────────────────────────────────
    if (!m.getSource("route")) {
      m.addSource("route", { type: "geojson", data: fc([]) });
      m.addLayer({
        id: "route-glow",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": BRAND, "line-width": 14, "line-opacity": 0.14, "line-blur": 4 },
      });
      m.addLayer({
        id: "route",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": BRAND, "line-width": 4 },
      });
    }

    // ── Demand / opportunity zones ─────────────────────────────────────────
    if (!m.getSource("zones")) {
      m.addSource("zones", { type: "geojson", data: fc([]) });

      // Outer halo (large, faint — like Uber surge glow)
      m.addLayer({
        id: "zones-halo",
        type: "circle",
        source: "zones",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["get", "intensity"], 0, 20, 1, 62],
          "circle-color": [
            "interpolate", ["linear"], ["get", "intensity"],
            0, "#22C55E", 0.4, "#EAB308", 0.7, "#F97316", 1, "#EF4444",
          ],
          "circle-opacity": ["interpolate", ["linear"], ["get", "intensity"], 0, 0.03, 1, 0.11],
          "circle-stroke-width": 0,
        },
      });

      // Main zone circle (coloured by opportunity — green → red)
      m.addLayer({
        id: "zones",
        type: "circle",
        source: "zones",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["get", "intensity"], 0, 9, 1, 29],
          "circle-color": [
            "interpolate", ["linear"], ["get", "intensity"],
            0, "#22C55E", 0.35, "#84CC16", 0.55, "#EAB308", 0.75, "#F97316", 1, "#EF4444",
          ],
          "circle-opacity": ["interpolate", ["linear"], ["get", "intensity"], 0, 0.15, 1, 0.42],
          "circle-stroke-color": [
            "interpolate", ["linear"], ["get", "intensity"],
            0, "#22C55E", 0.5, "#EAB308", 1, "#EF4444",
          ],
          "circle-stroke-width": 1.5,
          "circle-stroke-opacity": ["interpolate", ["linear"], ["get", "intensity"], 0, 0.3, 1, 0.78],
        },
      });

      // Zone name labels for high-opportunity areas
      m.addLayer({
        id: "zones-label",
        type: "symbol",
        source: "zones",
        filter: [">=", ["get", "intensity"], 0.58],
        layout: {
          "text-field": ["get", "name"],
          "text-size": 11,
          "text-offset": [0, 2.4],
          "text-anchor": "top",
          "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Regular"],
        },
        paint: {
          "text-color": [
            "interpolate", ["linear"], ["get", "intensity"],
            0.58, "#EAB308", 0.78, "#F97316", 1, "#EF4444",
          ],
          "text-halo-color": haloColor,
          "text-halo-width": 1.5,
          "text-opacity": ["interpolate", ["linear"], ["get", "intensity"], 0.58, 0.0, 0.7, 1.0],
        },
      });

      // Zone click popup (unchanged from original, now richer)
      m.on("click", "zones", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as { name: string; passengers: number; taxis: number; score: number; intensity: number };
        const col = surgeColor(p.intensity);
        new mapboxgl.Popup({ closeButton: false, offset: 14 })
          .setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number])
          .setHTML(
            `<div style="font-family:var(--font-mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;opacity:.55">${p.name}</div>
             <div style="margin-top:6px;font-size:13px">${p.passengers} passengers / ${p.taxis} taxis nearby</div>
             <div style="margin-top:4px;display:flex;align-items:center;gap:6px">
               <div style="flex:1;height:4px;border-radius:4px;background:${col}22">
                 <div style="width:${Math.round(p.intensity * 100)}%;height:100%;border-radius:4px;background:${col}"></div>
               </div>
               <span style="color:${col};font-weight:700;font-size:13px">${p.score}</span>
             </div>`,
          )
          .addTo(m);
      });
      m.on("mouseenter", "zones", () => (m.getCanvas().style.cursor = "pointer"));
      m.on("mouseleave", "zones", () => (m.getCanvas().style.cursor = ""));
    }

    // ── Fleet dots ────────────────────────────────────────────────────────
    if (!m.getSource("taxis")) {
      m.addSource("taxis", { type: "geojson", data: fc([]) });
      m.addLayer({
        id: "taxis",
        type: "circle",
        source: "taxis",
        paint: {
          "circle-radius": 3.6,
          "circle-color": ["get", "color"],
          "circle-stroke-color": "rgba(0,0,0,0.3)",
          "circle-stroke-width": 0.6,
        },
      });
    }
  }

  // Create map once
  useEffect(() => {
    if (!container.current || map.current) return;
    mapboxgl.accessToken = TOKEN as string;
    const m = new mapboxgl.Map({
      container: container.current,
      style: styleFor(resolvedTheme),
      center: CENTER,
      zoom: 13,
      pitch: 30,
      bearing: 0,
      attributionControl: false,
    });
    m.addControl(new mapboxgl.NavigationControl({ showCompass: true }), "bottom-right");
    m.addControl(new mapboxgl.ScaleControl({ unit: "metric" }), "bottom-left");
    m.addControl(new mapboxgl.GeolocateControl({ trackUserLocation: false }), "bottom-right");
    styleTheme.current = resolvedTheme === "light" ? "light" : "dark";
    m.on("load", () => {
      installLayers(m);
      setReady(true);
    });
    map.current = m;
    return () => {
      driverMarker.current?.remove();
      driverMarker.current = null;
      m.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swap style on theme change, then reinstall all layers
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

  // ── Data effects ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!ready || !map.current) return;
    (map.current.getSource("corridors") as mapboxgl.GeoJSONSource | undefined)
      ?.setData(fc(corridorFeatures(corridors, traffic)));
  }, [ready, corridors, traffic]);

  useEffect(() => {
    if (!ready || !map.current) return;
    (map.current.getSource("taxis") as mapboxgl.GeoJSONSource | undefined)
      ?.setData(fc(showTaxis ? taxiFeatures(taxis) : []));
  }, [ready, taxis, showTaxis]);

  useEffect(() => {
    if (!ready || !map.current) return;
    (map.current.getSource("zones") as mapboxgl.GeoJSONSource | undefined)
      ?.setData(fc(showZones ? zoneFeatures(zones) : []));
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

  // Origin / destination pin markers
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

  // Driver car marker — smoothly follows driverLocation
  useEffect(() => {
    if (!ready || !map.current) return;

    if (driverLocation) {
      const lngLat = driverLocation as [number, number];
      if (driverMarker.current) {
        driverMarker.current.setLngLat(lngLat);
        const inner = driverMarker.current.getElement().querySelector<HTMLDivElement>("#driver-inner");
        if (inner) inner.style.transform = `rotate(${driverHeading}deg)`;
      } else {
        const el = createDriverEl();
        driverMarker.current = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat(lngLat)
          .addTo(map.current);
        const inner = el.querySelector<HTMLDivElement>("#driver-inner");
        if (inner) inner.style.transform = `rotate(${driverHeading}deg)`;
      }
      // Keep driver smoothly in frame
      map.current.easeTo({ center: lngLat, duration: 350 });
    } else {
      driverMarker.current?.remove();
      driverMarker.current = null;
    }
  }, [ready, driverLocation, driverHeading]);

  return <div ref={container} className="h-full w-full" />;
}

// ── Schematic (token-free) fallback ─────────────────────────────────────────

function SchematicMap({
  corridors, traffic, taxis, zones, routePath, origin, destination,
  showTaxis = true, showZones = true,
  driverLocation, driverHeading = 0,
}: CityMapProps) {
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

  const levelById = new Map(traffic.map((t) => [t.segmentId, t]));
  const maxOpp = Math.max(1, ...zones.map((z) => z.opportunityScore));

  return (
    <div className="relative h-full w-full overflow-hidden">
      <svg viewBox={`0 0 ${W} ${H}`} className="hairline-grid h-full w-full [background-size:32px_32px]" preserveAspectRatio="xMidYMid slice">
        {/* Demand zones — Uber-style surge colouring */}
        {showZones &&
          zones.map((z) => {
            const [x, y] = project([z.lng, z.lat]);
            const intensity = z.opportunityScore / maxOpp;
            const r = 10 + intensity * 34;
            const col = surgeColor(intensity);
            return (
              <g key={z.id}>
                <circle cx={x} cy={y} r={r * 1.9} fill={col} fillOpacity={0.04} />
                <circle cx={x} cy={y} r={r} fill={col} fillOpacity={0.08 + intensity * 0.18} stroke={col} strokeOpacity={0.4 + intensity * 0.35} strokeWidth={1.5} />
                {intensity >= 0.58 && (
                  <text x={x} y={y + r + 12} textAnchor="middle" fontSize={9} fill={col} fillOpacity={0.85} fontFamily="monospace">
                    {z.name}
                  </text>
                )}
              </g>
            );
          })}

        {/* Road corridors */}
        {corridors.map((c) => {
          const t = levelById.get(c.id);
          const level = t?.level ?? "free";
          const congestion = t?.congestionScore ?? 0.1;
          const w = 3.5 + congestion * 6.5;
          const d = c.path.map(project).map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
          return <path key={c.id} d={d} fill="none" stroke={TRAFFIC_COLOR[level]} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />;
        })}

        {/* Planned route */}
        {routePath?.length ? (
          <path
            d={routePath.map(project).map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ")}
            fill="none" stroke={BRAND} strokeWidth={4} strokeDasharray="3 8" strokeLinecap="round"
          />
        ) : null}

        {/* Fleet dots */}
        {showTaxis &&
          taxis.map((t) => {
            const [x, y] = project([t.lng, t.lat]);
            return <circle key={t.id} cx={x} cy={y} r={3} fill={STATUS_COLOR[t.status]} stroke="rgba(0,0,0,0.3)" strokeWidth={0.6} />;
          })}

        {/* Origin / destination */}
        {origin && <EndpointDot p={project(origin)} color="#22C55E" />}
        {destination && <EndpointDot p={project(destination)} color="#EF4444" />}

        {/* Driver car */}
        {driverLocation && (() => {
          const [x, y] = project(driverLocation);
          const hr = ((driverHeading - 90) * Math.PI) / 180;
          const nx = x + Math.cos(hr) * 13;
          const ny = y + Math.sin(hr) * 13;
          return (
            <g>
              <circle cx={x} cy={y} r={16} fill="none" stroke={BRAND} strokeOpacity={0.25} strokeWidth={1}>
                <animate attributeName="r" values="16;26;16" dur="2s" repeatCount="indefinite" />
                <animate attributeName="stroke-opacity" values="0.3;0;0.3" dur="2s" repeatCount="indefinite" />
              </circle>
              <circle cx={x} cy={y} r={10} fill={BRAND} stroke="white" strokeWidth={2} />
              <line x1={x} y1={y} x2={nx} y2={ny} stroke="#22C55E" strokeWidth={2.5} strokeLinecap="round" />
            </g>
          );
        })()}
      </svg>

      <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg border border-hairline bg-surface/85 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-faint">
        Schematic view · Add NEXT_PUBLIC_MAPBOX_TOKEN for live tiles
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
