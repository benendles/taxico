"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/useAuth";
import { useCityState } from "@/lib/useCityState";
import type { DemandZone, SegmentTraffic, User } from "@/lib/types";
import { Shell } from "@/components/Shell";
import { BootScreen, LevelPill, SectionTitle, StatTile } from "@/components/widgets";
import { GaugeIcon, RouteIcon, SignalIcon, TaxiMark, UsersIcon, ShieldIcon } from "@/components/icons";
import { relativeTime } from "@/lib/ui";

interface Analytics {
  acceptedRoutes: { id: string; driver: string; via: string[]; profitScore: number; at: number }[];
  acceptedCount: number;
  corridors: SegmentTraffic[];
  zones: DemandZone[];
}

export default function AdminPage() {
  const { user, checked } = useRequireAuth("admin");
  const { state, status } = useCityState();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!checked) return;
    let active = true;
    const load = () => {
      api
        .adminAnalytics()
        .then((a) => active && setAnalytics(a))
        .catch((e) => active && setError(e instanceof Error ? e.message : "Failed to load analytics."));
    };
    load();
    api.adminUsers().then((r) => active && setUsers(r.users)).catch(() => {});
    const id = setInterval(load, 8000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [checked]);

  if (!checked) return <BootScreen />;

  const s = state?.stats;
  const corridors = analytics?.corridors ?? state?.traffic ?? [];
  const zones = [...(analytics?.zones ?? state?.zones ?? [])].sort((a, b) => b.opportunityScore - a.opportunityScore);

  return (
    <Shell user={user} status={status}>
      <div className="mb-5 rounded-2xl border border-hairline bg-surface p-6 shadow-card">
        <p className="eyebrow text-brand">Administration</p>
        <h1 className="mt-1.5 font-display text-[26px] font-bold tracking-tight">City operations</h1>
        <p className="mt-1 text-sm text-muted">
          Live fleet, corridor traffic, demand and accepted-route activity across Yaoundé.
        </p>
      </div>

      {error && <p className="mb-4 rounded-xl border border-severe/40 bg-severe/10 px-4 py-3 text-sm text-severe">{error}</p>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Active taxis" value={s?.activeTaxis ?? "-"} icon={TaxiMark} accent />
        <StatTile label="Carrying fare" value={s?.occupiedTaxis ?? "-"} icon={UsersIcon} />
        <StatTile label="Congested" value={s?.congestedCorridors ?? "-"} icon={SignalIcon} />
        <StatTile label="Avg speed" value={s?.avgCitySpeedKmh ?? "-"} unit="km/h" icon={GaugeIcon} />
        <StatTile label="Routes accepted" value={analytics?.acceptedCount ?? "-"} icon={RouteIcon} />
        <StatTile label="Registered users" value={users.length || "-"} icon={ShieldIcon} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="panel p-5">
          <SectionTitle hint="FR4">Corridor traffic</SectionTitle>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline text-left font-mono text-[10px] uppercase tracking-widest text-faint">
                <th className="pb-2 font-normal">Corridor</th>
                <th className="pb-2 font-normal">Level</th>
                <th className="pb-2 text-right font-normal">Speed</th>
                <th className="pb-2 text-right font-normal">Veh.</th>
              </tr>
            </thead>
            <tbody>
              {corridors.map((c) => (
                <tr key={c.segmentId} className="border-b border-hairline/60 last:border-0">
                  <td className="py-2.5">{c.name}</td>
                  <td className="py-2.5"><LevelPill level={c.level} /></td>
                  <td className="py-2.5 text-right font-mono text-muted tabular-nums">{c.avgSpeedKmh} km/h</td>
                  <td className="py-2.5 text-right font-mono text-muted tabular-nums">{c.vehicleCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="panel p-5">
          <SectionTitle hint="FR9">Demand &amp; opportunity</SectionTitle>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline text-left font-mono text-[10px] uppercase tracking-widest text-faint">
                <th className="pb-2 font-normal">Zone</th>
                <th className="pb-2 text-right font-normal">Passengers</th>
                <th className="pb-2 text-right font-normal">Taxis</th>
                <th className="pb-2 text-right font-normal">Score</th>
              </tr>
            </thead>
            <tbody>
              {zones.map((z) => (
                <tr key={z.id} className="border-b border-hairline/60 last:border-0">
                  <td className="py-2.5">{z.name}</td>
                  <td className="py-2.5 text-right font-mono text-muted tabular-nums">{z.passengerDensity}</td>
                  <td className="py-2.5 text-right font-mono text-muted tabular-nums">{z.taxiDensity}</td>
                  <td className="py-2.5 text-right font-mono text-brand tabular-nums">{z.opportunityScore}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="panel p-5">
          <SectionTitle hint="FR1">User accounts</SectionTitle>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline text-left font-mono text-[10px] uppercase tracking-widest text-faint">
                <th className="pb-2 font-normal">Name</th>
                <th className="pb-2 font-normal">Email</th>
                <th className="pb-2 text-right font-normal">Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-hairline/60 last:border-0">
                  <td className="py-2.5">{u.name}</td>
                  <td className="py-2.5 font-mono text-muted">{u.email}</td>
                  <td className="py-2.5 text-right">
                    <span className="tag border-hairline capitalize text-muted">{u.role}</span>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={3} className="py-3 text-xs text-muted">No users loaded.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="panel p-5">
          <SectionTitle hint="FR6">Accepted routes</SectionTitle>
          <div className="space-y-2">
            {(analytics?.acceptedRoutes ?? []).map((r) => (
              <div key={r.id} className="flex items-center gap-3 border-b border-hairline/60 py-2 last:border-0">
                <span className="text-sm">{r.driver}</span>
                <span className="flex-1 truncate font-mono text-[11px] text-faint">{r.via.join(" → ")}</span>
                <span className="font-mono text-xs text-brand tabular-nums">{r.profitScore}</span>
                <span className="font-mono text-[10px] text-faint">{relativeTime(r.at)}</span>
              </div>
            ))}
            {(analytics?.acceptedRoutes?.length ?? 0) === 0 && (
              <p className="py-2 text-xs text-muted">No routes accepted yet. Accept one from the driver dashboard.</p>
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
}
