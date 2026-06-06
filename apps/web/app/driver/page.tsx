"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/useAuth";
import { useCityState } from "@/lib/useCityState";
import { interpolateAlongPath } from "@/lib/geo";
import type { Corridor, LngLat, Place, RouteOption } from "@/lib/types";
import { Shell } from "@/components/Shell";
import { BootScreen, LevelPill, NotificationItem, PlaceSelect, ScoreBar, SectionTitle, StatTile } from "@/components/widgets";
import { ArrowRight, GaugeIcon, PulseIcon, RouteIcon, SignalIcon, TaxiMark, UsersIcon } from "@/components/icons";
import { cx, TRAFFIC_COLOR } from "@/lib/ui";

const CityMap = dynamic(() => import("@/components/CityMap"), { ssr: false });

// Progress speed: 0.0035 per 200ms ≈ 57 seconds to traverse any route in demo mode.
const NAV_STEP = 0.0035;
const NAV_INTERVAL_MS = 200;

export default function DriverPage() {
  const { user, checked } = useRequireAuth("driver");
  const { state, status } = useCityState();

  const [corridors, setCorridors] = useState<Corridor[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [originId, setOriginId] = useState("");
  const [destId, setDestId] = useState("");
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Navigation state ──────────────────────────────────────────────────────
  const [navigating, setNavigating] = useState(false);
  const [arrived, setArrived] = useState(false);
  const [navProgress, setNavProgress] = useState(0);
  const [driverPos, setDriverPos] = useState<LngLat | null>(null);
  const [driverHeading, setDriverHeading] = useState(0);
  const navPathRef = useRef<LngLat[]>([]);
  const navProgressRef = useRef(0);
  const navIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    api
      .geo()
      .then(({ segments, places }) => {
        setCorridors(segments);
        setPlaces(places);
        if (places.length >= 2) {
          setOriginId(places[0].id);
          setDestId(places[places.length - 1].id);
        }
      })
      .catch(() => setError("Could not load the city map. Is the API running?"));
  }, []);

  const origin = places.find((p) => p.id === originId);
  const destination = places.find((p) => p.id === destId);
  const selected = routes.find((r) => r.id === selectedId) ?? routes[0];

  const topZones = useMemo(
    () => [...(state?.zones ?? [])].sort((a, b) => b.opportunityScore - a.opportunityScore).slice(0, 5),
    [state?.zones],
  );

  const congestedCorridors = useMemo(
    () =>
      [...(state?.traffic ?? [])]
        .filter((t) => t.level === "heavy" || t.level === "severe")
        .sort((a, b) => b.congestionScore - a.congestionScore)
        .slice(0, 5),
    [state?.traffic],
  );

  // Derived navigation values
  const remainingMin = selected ? Math.max(1, Math.round(selected.etaMin * (1 - navProgress))) : 0;
  const remainingKm = selected ? Number((selected.distanceKm * (1 - navProgress)).toFixed(1)) : 0;
  const currentViaIdx = selected
    ? Math.min(Math.floor(navProgress * selected.via.length), selected.via.length - 1)
    : 0;
  const currentStreet = selected?.via[currentViaIdx] ?? "";

  // ── Navigation interval ───────────────────────────────────────────────────
  useEffect(() => {
    if (!navigating) return;
    navIntervalRef.current = setInterval(() => {
      navProgressRef.current += NAV_STEP;
      const t = navProgressRef.current;
      if (t >= 1) {
        navProgressRef.current = 1;
        const { point, heading } = interpolateAlongPath(navPathRef.current, 1);
        setNavProgress(1);
        setDriverPos(point);
        setDriverHeading(heading);
        clearInterval(navIntervalRef.current!);
        setNavigating(false);
        setArrived(true);
        return;
      }
      setNavProgress(t);
      const { point, heading } = interpolateAlongPath(navPathRef.current, t);
      setDriverPos(point);
      setDriverHeading(heading);
    }, NAV_INTERVAL_MS);
    return () => {
      if (navIntervalRef.current) clearInterval(navIntervalRef.current);
    };
  }, [navigating]);

  // ── Route actions ─────────────────────────────────────────────────────────

  async function computeRoutes() {
    if (!origin || !destination) return;
    setBusy(true);
    setError(null);
    stopNavigation();
    try {
      const { routes } = await api.recommendRoutes([origin.lng, origin.lat], [destination.lng, destination.lat]);
      setRoutes(routes);
      setSelectedId(routes[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not compute routes.");
    } finally {
      setBusy(false);
    }
  }

  async function acceptRoute() {
    if (!selected) return;
    try {
      await api.acceptRoute(selected.via, selected.profitScore);
      // Start navigation animation
      navPathRef.current = selected.path;
      navProgressRef.current = 0;
      setNavProgress(0);
      setArrived(false);
      if (selected.path.length) {
        const { point, heading } = interpolateAlongPath(selected.path, 0);
        setDriverPos(point);
        setDriverHeading(heading);
      }
      setNavigating(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept route.");
    }
  }

  function stopNavigation() {
    if (navIntervalRef.current) clearInterval(navIntervalRef.current);
    setNavigating(false);
    setDriverPos(null);
    setNavProgress(0);
    navProgressRef.current = 0;
    setArrived(false);
  }

  if (!checked) return <BootScreen />;

  const s = state?.stats;
  const maxOpp = Math.max(1, ...topZones.map((z) => z.opportunityScore));

  return (
    <Shell user={user} status={status}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="mb-5 rounded-2xl border border-hairline bg-surface p-6 shadow-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow text-brand">Driver dashboard</p>
            <h1 className="mt-1.5 font-display text-[26px] font-bold tracking-tight">
              Good driving, {user?.name?.split(" ")[0] ?? "driver"}.
            </h1>
            <p className="mt-1 text-sm text-muted">
              Live traffic, turn-by-turn navigation and hot-zone demand across Yaoundé.
            </p>
          </div>
          <div className="hidden rounded-xl border border-hairline bg-raised/50 px-4 py-2.5 sm:block">
            <div className="font-body text-[10px] font-semibold uppercase tracking-[0.1em] text-faint">Top opportunity now</div>
            <div className="mt-0.5 font-display text-base font-semibold text-brand">{s?.topOpportunityZone ?? "-"}</div>
          </div>
        </div>
      </div>

      {/* ── Stats row ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
        <StatTile label="Active taxis" value={s?.activeTaxis ?? "-"} icon={TaxiMark} accent />
        <StatTile label="Carrying fare" value={s?.occupiedTaxis ?? "-"} icon={UsersIcon} />
        <StatTile label="Congested" value={s?.congestedCorridors ?? "-"} unit="corridors" icon={SignalIcon} />
        <StatTile label="Avg city speed" value={s?.avgCitySpeedKmh ?? "-"} unit="km/h" icon={GaugeIcon} />
        <StatTile label="Top opportunity" value={s?.topOpportunityZone ?? "-"} icon={PulseIcon} />
      </div>

      {/* ── Map + sidebar ───────────────────────────────────────────────── */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_400px]">
        {/* Map */}
        <div className="panel h-[420px] overflow-hidden xl:h-[640px]">
          <CityMap
            corridors={corridors}
            traffic={state?.traffic ?? []}
            taxis={state?.taxis ?? []}
            zones={state?.zones ?? []}
            routePath={selected?.path}
            origin={origin ? ([origin.lng, origin.lat] as LngLat) : null}
            destination={destination ? ([destination.lng, destination.lat] as LngLat) : null}
            driverLocation={driverPos}
            driverHeading={driverHeading}
          />
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4">

          {/* ── Active navigation HUD ──────────────────────────────────── */}
          {(navigating || arrived) && selected && (
            <div className={cx("panel p-5 border-l-4", navigating ? "border-brand" : "border-free")}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={cx("eyebrow", navigating ? "text-brand" : "text-free")}>
                    {navigating ? "Navigating" : "Arrived"}
                  </p>
                  <h2 className="mt-1 truncate font-display text-base font-bold leading-tight">
                    {navigating ? currentStreet : destination?.name ?? "Destination"}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={stopNavigation}
                  className="btn-ghost shrink-0 py-1.5 text-xs"
                >
                  {navigating ? "End" : "Done"}
                </button>
              </div>

              {navigating && (
                <>
                  <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-faint">ETA</p>
                      <p className="mt-0.5 font-display text-xl font-bold tabular-nums">{remainingMin}<span className="text-xs font-normal text-muted">m</span></p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-faint">Remaining</p>
                      <p className="mt-0.5 font-display text-xl font-bold tabular-nums">{remainingKm}<span className="text-xs font-normal text-muted">km</span></p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-faint">Done</p>
                      <p className="mt-0.5 font-display text-xl font-bold tabular-nums">{Math.round(navProgress * 100)}<span className="text-xs font-normal text-muted">%</span></p>
                    </div>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-raised">
                    <div
                      className="h-full rounded-full bg-brand transition-all duration-200"
                      style={{ width: `${navProgress * 100}%` }}
                    />
                  </div>
                  <p className="mt-2 truncate font-mono text-[11px] text-faint">
                    via {selected.via.join(" → ")}
                  </p>
                </>
              )}

              {arrived && (
                <p className="mt-3 rounded-lg border border-free/40 bg-free/10 px-3 py-2 text-xs text-free">
                  You have arrived at {destination?.name}.
                </p>
              )}
            </div>
          )}

          {/* ── Route planner (hidden while navigating) ─────────────────── */}
          {!navigating && !arrived && (
            <div className="panel p-5">
              <SectionTitle hint="FR5">Plan a route</SectionTitle>
              <div className="space-y-2">
                <PlaceSelect icon="origin" places={places} value={originId} onChange={setOriginId} />
                <PlaceSelect icon="dest" places={places} value={destId} onChange={setDestId} />
              </div>
              <button type="button" onClick={computeRoutes} disabled={busy || !origin || !destination} className="btn-primary mt-3 w-full disabled:opacity-50">
                {busy ? "Scoring routes…" : "Recommend routes"}
                {!busy && <RouteIcon width={16} />}
              </button>
              {error && <p className="mt-3 text-xs text-severe">{error}</p>}
            </div>
          )}

          {/* ── Recommended routes ───────────────────────────────────────── */}
          {routes.length > 0 && !navigating && !arrived && (
            <div className="panel p-5">
              <SectionTitle hint="Ranked by profit">Recommended routes</SectionTitle>
              <div className="space-y-2">
                {routes.map((r) => (
                  <button
                    type="button"
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    className={cx(
                      "w-full rounded-xl border p-3 text-left transition",
                      selected?.id === r.id ? "border-brand/50 bg-brand/5" : "border-hairline hover:border-brand/30",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className={cx("text-sm font-medium", r.recommended && "text-brand")}>{r.label}</span>
                      <span className="font-mono text-sm tabular-nums">{r.profitScore}</span>
                    </div>
                    <div className="mt-1 truncate font-mono text-[11px] text-faint">{r.via.join(" → ")}</div>
                    <div className="mt-1.5 flex gap-3 font-mono text-[11px] text-muted">
                      <span>{r.distanceKm} km</span>
                      <span>{r.etaMin} min</span>
                      <span>traffic {r.trafficScore}</span>
                    </div>
                  </button>
                ))}
              </div>

              {selected && (
                <div className="mt-4 space-y-2.5 border-t border-hairline pt-4">
                  <ScoreBar label="Traffic flow" value={selected.trafficScore} color="#22C55E" />
                  <ScoreBar label="Passenger opportunity" value={selected.opportunityScore} color="#1A56DB" />
                  <ScoreBar label="Low taxi saturation" value={selected.taxiDensityScore} color="#F59E0B" />
                  <button type="button" onClick={acceptRoute} className="btn-primary mt-3 w-full">
                    Accept &amp; navigate <ArrowRight width={16} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Live congestion alerts ───────────────────────────────────── */}
          {congestedCorridors.length > 0 && (
            <div className="panel p-5">
              <SectionTitle hint="Live">Congested roads</SectionTitle>
              <div className="-my-1">
                {congestedCorridors.map((t) => (
                  <div key={t.segmentId} className="flex items-center gap-3 border-b border-hairline py-2.5 last:border-0">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: TRAFFIC_COLOR[t.level] }}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm">{t.name}</span>
                    <span className="shrink-0 font-mono text-[11px] text-muted">{t.avgSpeedKmh} km/h</span>
                    <LevelPill level={t.level} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Opportunity zones — heat-coded ──────────────────────────── */}
          <div className="panel p-5">
            <SectionTitle hint="FR9">Opportunity zones</SectionTitle>
            <div className="-my-1">
              {topZones.map((z, i) => {
                const intensity = z.opportunityScore / maxOpp;
                const heatColor =
                  intensity > 0.85 ? "#EF4444"
                  : intensity > 0.70 ? "#F97316"
                  : intensity > 0.55 ? "#EAB308"
                  : intensity > 0.35 ? "#84CC16"
                  : "#22C55E";
                return (
                  <div key={z.id} className="flex items-center gap-3 border-b border-hairline py-2.5 last:border-0">
                    <span className="w-5 shrink-0 font-mono text-[11px] text-faint">{String(i + 1).padStart(2, "0")}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium">{z.name}</span>
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: heatColor }} />
                      </div>
                      <span className="font-mono text-[10px] text-faint">{z.passengerDensity}p · {z.taxiDensity} taxis</span>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="font-mono text-sm font-bold tabular-nums" style={{ color: heatColor }}>{z.opportunityScore}</span>
                      <div className="mt-0.5 h-1 w-14 overflow-hidden rounded-full bg-raised">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${intensity * 100}%`, background: heatColor }} />
                      </div>
                    </div>
                  </div>
                );
              })}
              {topZones.length === 0 && <p className="py-2 text-xs text-muted">Waiting for live data…</p>}
            </div>
          </div>

          {/* ── Driver notifications ─────────────────────────────────────── */}
          <div className="panel p-5">
            <SectionTitle hint="FR10">Alerts</SectionTitle>
            <div className="-my-1">
              {(state?.notifications ?? []).slice(0, 5).map((n) => (
                <NotificationItem key={n.id} n={n} />
              ))}
              {(state?.notifications?.length ?? 0) === 0 && (
                <p className="py-2 text-xs text-muted">No alerts yet. The city is calm.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
