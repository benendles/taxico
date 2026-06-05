"use client";

import type { ComponentType, SVGProps } from "react";
import type { DriverNotification, Place, TrafficLevel } from "@/lib/types";
import { cx, relativeTime, TRAFFIC_COLOR, TRAFFIC_LABEL } from "@/lib/ui";
import { BoltIcon, FlagIcon, PinIcon, PulseIcon, RouteIcon, SignalIcon } from "./icons";

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

export function StatTile({
  label,
  value,
  unit,
  context,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  unit?: string;
  context?: string;
  icon?: IconType;
  accent?: boolean;
}) {
  return (
    <div className="panel card-hover relative overflow-hidden p-5">
      {accent && <span className="absolute inset-x-0 top-0 h-[3px] bg-brand" />}
      <div className="flex items-start justify-between gap-2">
        <span className="font-body text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">{label}</span>
        {Icon && (
          <span
            className={cx(
              "flex h-8 w-8 items-center justify-center rounded-[10px]",
              accent ? "bg-brand-soft text-brand" : "bg-raised text-muted",
            )}
          >
            <Icon width={17} height={17} />
          </span>
        )}
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className={cx("stat-value", accent && "text-brand")}>{value}</span>
        {unit && <span className="text-xs font-medium text-muted">{unit}</span>}
      </div>
      {context && <div className="mt-1.5 text-xs text-muted">{context}</div>}
    </div>
  );
}

export function LevelPill({ level }: { level: TrafficLevel }) {
  const color = TRAFFIC_COLOR[level];
  return (
    <span className="tag" style={{ borderColor: `${color}55`, color, background: `${color}12` }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {TRAFFIC_LABEL[level]}
    </span>
  );
}

export function ScoreBar({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className="font-mono text-ink">{value}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-raised">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${value}%`, background: color ?? "rgb(var(--brand))" }}
        />
      </div>
    </div>
  );
}

const NOTIF_ICON: Record<DriverNotification["kind"], ComponentType<SVGProps<SVGSVGElement>>> = {
  congestion: SignalIcon,
  route: RouteIcon,
  opportunity: PulseIcon,
};
const NOTIF_COLOR: Record<DriverNotification["kind"], string> = {
  congestion: "#EF4444",
  route: "#1A56DB",
  opportunity: "#22C55E",
};

export function NotificationItem({ n }: { n: DriverNotification }) {
  const Icon = NOTIF_ICON[n.kind] ?? BoltIcon;
  const color = NOTIF_COLOR[n.kind];
  return (
    <div className="flex gap-3 border-b border-hairline py-3 last:border-0">
      <div
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border"
        style={{ borderColor: `${color}33`, color, background: `${color}10` }}
      >
        <Icon width={16} height={16} />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{n.title}</p>
          <span className="ml-auto shrink-0 font-mono text-[10px] text-faint">{relativeTime(n.at)}</span>
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">{n.body}</p>
      </div>
    </div>
  );
}

export function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="-mx-5 -mt-5 mb-4 flex items-center justify-between border-b border-hairline bg-raised/40 px-5 py-3">
      <h3 className="font-display text-[15px] font-semibold tracking-tight text-ink">{children}</h3>
      {hint && (
        <span className="rounded-md bg-surface px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-faint">
          {hint}
        </span>
      )}
    </div>
  );
}

export function PlaceSelect({
  icon,
  places,
  value,
  onChange,
}: {
  icon: "origin" | "dest";
  places: Place[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-hairline bg-surface px-3 transition focus-within:border-brand/50 focus-within:ring-4 focus-within:ring-brand/10">
      <span className={icon === "origin" ? "text-free" : "text-severe"}>
        {icon === "origin" ? <PinIcon width={18} /> : <FlagIcon width={18} />}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent py-2.5 text-sm text-ink outline-none [&>option]:bg-surface [&>option]:text-ink"
      >
        {places.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export function BootScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <div className="flex items-center gap-3 text-muted">
        <span className="h-2 w-2 animate-pulse rounded-full bg-brand" />
        <span className="font-mono text-xs uppercase tracking-widest">Loading workspace…</span>
      </div>
    </div>
  );
}
