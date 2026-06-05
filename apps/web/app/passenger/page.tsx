"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/useAuth";
import { useCityState } from "@/lib/useCityState";
import type { AvailabilityForecast, Corridor, LngLat, Place } from "@/lib/types";
import { Shell } from "@/components/Shell";
import { BootScreen, LevelPill, PlaceSelect, SectionTitle } from "@/components/widgets";
import { AVAILABILITY } from "@/lib/ui";
import { ArrowRight, ClockIcon, TaxiMark } from "@/components/icons";

const CityMap = dynamic(() => import("@/components/CityMap"), { ssr: false });

export default function PassengerPage() {
  const { user, checked } = useRequireAuth("passenger");
  const { state, status } = useCityState();

  const [corridors, setCorridors] = useState<Corridor[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [originId, setOriginId] = useState("");
  const [destId, setDestId] = useState("");
  const [forecast, setForecast] = useState<AvailabilityForecast | null>(null);
  const [routePath, setRoutePath] = useState<LngLat[] | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .geo()
      .then(({ segments, places }) => {
        setCorridors(segments);
        setPlaces(places);
        if (places.length >= 2) {
          setOriginId(places[1].id);
          setDestId(places[places.length - 2].id);
        }
      })
      .catch(() => setError("Could not load the city map. Is the API running?"));
  }, []);

  const origin = places.find((p) => p.id === originId);
  const destination = places.find((p) => p.id === destId);

  async function checkAvailability() {
    if (!origin || !destination) return;
    setBusy(true);
    setError(null);
    try {
      const [{ forecast }, { routes }] = await Promise.all([
        api.forecast({
          origin: [origin.lng, origin.lat],
          destination: [destination.lng, destination.lat],
          originName: origin.name,
          destinationName: destination.name,
        }),
        api.recommendRoutes([origin.lng, origin.lat], [destination.lng, destination.lat]),
      ]);
      setForecast(forecast);
      setRoutePath(routes[0]?.path);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not estimate availability.");
    } finally {
      setBusy(false);
    }
  }

  if (!checked) return <BootScreen />;

  const avail = forecast ? AVAILABILITY[forecast.availability] : null;

  return (
    <Shell user={user} status={status}>
      <div className="mb-5 rounded-2xl border border-hairline bg-surface p-6 shadow-card">
        <p className="eyebrow text-brand">Passenger view</p>
        <h1 className="mt-1.5 font-display text-[26px] font-bold tracking-tight">Where are you heading?</h1>
        <p className="mt-1 max-w-xl text-sm text-muted">
          Choose your route and Taxico estimates how many taxis pass it and how long you can expect
          to wait, before you leave the house.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[400px_1fr]">
        <div className="flex flex-col gap-4">
          <div className="panel p-5">
            <SectionTitle hint="FR8">Your route</SectionTitle>
            <div className="space-y-2">
              <PlaceSelect icon="origin" places={places} value={originId} onChange={setOriginId} />
              <PlaceSelect icon="dest" places={places} value={destId} onChange={setDestId} />
            </div>
            <button onClick={checkAvailability} disabled={busy || !origin || !destination} className="btn-primary mt-3 w-full disabled:opacity-50">
              {busy ? "Estimating…" : "Check availability"}
              {!busy && <ArrowRight width={16} />}
            </button>
            {error && <p className="mt-3 text-xs text-severe">{error}</p>}
          </div>

          {forecast && avail && (
            <div className="panel overflow-hidden">
              <div className="border-b border-hairline p-5">
                <div className="flex items-center justify-between">
                  <span className="eyebrow">Taxi availability</span>
                  <span className="tag" style={{ borderColor: `${avail.color}55`, color: avail.color, background: `${avail.color}12` }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: avail.color }} />
                    {avail.label}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <Metric icon={<TaxiMark width={18} />} value={forecast.taxisPer10Min} unit="taxis / 10 min" label="Passing your stop" />
                  <Metric icon={<ClockIcon width={18} />} value={forecast.waitMin} unit="min" label="Expected wait" />
                </div>
              </div>
              <div className="grid grid-cols-3 divide-x divide-hairline">
                <MiniStat label="Distance" value={`${forecast.distanceKm} km`} />
                <MiniStat label="Travel time" value={`${forecast.etaMin} min`} />
                <div className="flex flex-col items-center justify-center px-2 py-4">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-faint">Traffic</span>
                  <div className="mt-2">
                    <LevelPill level={forecast.trafficLevel} />
                  </div>
                </div>
              </div>
              <div className="border-t border-hairline px-5 py-3">
                <span className="font-mono text-[10px] uppercase tracking-widest text-faint">Via</span>
                <p className="mt-1 text-sm">{forecast.via.join(" → ")}</p>
              </div>
            </div>
          )}
        </div>

        <div className="panel h-[420px] overflow-hidden xl:h-[640px]">
          <CityMap
            corridors={corridors}
            traffic={state?.traffic ?? []}
            taxis={state?.taxis ?? []}
            zones={state?.zones ?? []}
            routePath={routePath}
            origin={origin ? ([origin.lng, origin.lat] as LngLat) : null}
            destination={destination ? ([destination.lng, destination.lat] as LngLat) : null}
            showZones={false}
          />
        </div>
      </div>
    </Shell>
  );
}

function Metric({ icon, value, unit, label }: { icon: React.ReactNode; value: number; unit: string; label: string }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-brand">{icon}</div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="font-display text-[34px] font-bold tracking-tight tabular-nums">{value}</span>
        <span className="text-xs text-muted">{unit}</span>
      </div>
      <div className="mt-1 text-xs text-muted">{label}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-2 py-4">
      <span className="font-mono text-[10px] uppercase tracking-widest text-faint">{label}</span>
      <span className="mt-2 text-sm">{value}</span>
    </div>
  );
}
