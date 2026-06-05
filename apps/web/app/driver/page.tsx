"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/useAuth";
import { useCityState } from "@/lib/useCityState";
import type { Corridor, LngLat, Place, RouteOption } from "@/lib/types";
import { Shell } from "@/components/Shell";
import { BootScreen, NotificationItem, PlaceSelect, ScoreBar, SectionTitle, StatTile } from "@/components/widgets";
import { ArrowRight, GaugeIcon, PulseIcon, RouteIcon, SignalIcon, TaxiMark, UsersIcon } from "@/components/icons";
import { cx } from "@/lib/ui";

const CityMap = dynamic(() => import("@/components/CityMap"), { ssr: false });

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
  const [accepted, setAccepted] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  async function computeRoutes() {
    if (!origin || !destination) return;
    setBusy(true);
    setError(null);
    setAccepted(null);
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
      setAccepted(`Navigating ${selected.via.join(" → ")}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept route.");
    }
  }

  if (!checked) return <BootScreen />;

  const s = state?.stats;

  return (
    <Shell user={user} status={status}>
      <div className="mb-5 rounded-2xl border border-hairline bg-surface p-6 shadow-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow text-brand">Driver dashboard</p>
            <h1 className="mt-1.5 font-display text-[26px] font-bold tracking-tight">
              Good driving, {user?.name?.split(" ")[0] ?? "driver"}.
            </h1>
            <p className="mt-1 text-sm text-muted">
              Live traffic, route recommendations and opportunity zones across the Yaoundé network.
            </p>
          </div>
          <div className="hidden rounded-xl border border-hairline bg-raised/50 px-4 py-2.5 sm:block">
            <div className="font-body text-[10px] font-semibold uppercase tracking-[0.1em] text-faint">Top opportunity now</div>
            <div className="mt-0.5 font-display text-base font-semibold text-brand">{s?.topOpportunityZone ?? "-"}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
        <StatTile label="Active taxis" value={s?.activeTaxis ?? "-"} icon={TaxiMark} accent />
        <StatTile label="Carrying fare" value={s?.occupiedTaxis ?? "-"} icon={UsersIcon} />
        <StatTile label="Congested" value={s?.congestedCorridors ?? "-"} unit="corridors" icon={SignalIcon} />
        <StatTile label="Avg city speed" value={s?.avgCitySpeedKmh ?? "-"} unit="km/h" icon={GaugeIcon} />
        <StatTile label="Top opportunity" value={s?.topOpportunityZone ?? "-"} icon={PulseIcon} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_400px]">
        <div className="panel h-[420px] overflow-hidden xl:h-[640px]">
          <CityMap
            corridors={corridors}
            traffic={state?.traffic ?? []}
            taxis={state?.taxis ?? []}
            zones={state?.zones ?? []}
            routePath={selected?.path}
            origin={origin ? ([origin.lng, origin.lat] as LngLat) : null}
            destination={destination ? ([destination.lng, destination.lat] as LngLat) : null}
          />
        </div>

        <div className="flex flex-col gap-4">
          <div className="panel p-5">
            <SectionTitle hint="FR5">Plan a route</SectionTitle>
            <div className="space-y-2">
              <PlaceSelect icon="origin" places={places} value={originId} onChange={setOriginId} />
              <PlaceSelect icon="dest" places={places} value={destId} onChange={setDestId} />
            </div>
            <button onClick={computeRoutes} disabled={busy || !origin || !destination} className="btn-primary mt-3 w-full disabled:opacity-50">
              {busy ? "Scoring routes…" : "Recommend routes"}
              {!busy && <RouteIcon width={16} />}
            </button>
            {error && <p className="mt-3 text-xs text-severe">{error}</p>}
          </div>

          {routes.length > 0 && (
            <div className="panel p-5">
              <SectionTitle hint="Ranked by profit score">Recommended routes</SectionTitle>
              <div className="space-y-2">
                {routes.map((r) => (
                  <button
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
                  <button onClick={acceptRoute} className="btn-primary mt-3 w-full">
                    Accept &amp; navigate <ArrowRight width={16} />
                  </button>
                  {accepted && (
                    <p className="rounded-lg border border-free/40 bg-free/10 px-3 py-2 text-xs text-free">{accepted}</p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="panel p-5">
            <SectionTitle hint="FR9">Opportunity zones</SectionTitle>
            <div className="space-y-2.5">
              {topZones.map((z, i) => (
                <div key={z.id} className="flex items-center gap-3">
                  <span className="font-mono text-xs text-faint">{String(i + 1).padStart(2, "0")}</span>
                  <span className="flex-1 text-sm">{z.name}</span>
                  <span className="font-mono text-[11px] text-faint">{z.passengerDensity}p / {z.taxiDensity}t</span>
                  <span className="w-10 text-right font-mono text-sm text-brand tabular-nums">{z.opportunityScore}</span>
                </div>
              ))}
              {topZones.length === 0 && <p className="text-xs text-muted">Waiting for live data…</p>}
            </div>
          </div>

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
