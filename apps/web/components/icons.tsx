import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function TaxiMark(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 11l1.4-3.6A2 2 0 0 1 8.3 6h7.4a2 2 0 0 1 1.9 1.4L19 11" />
      <rect x="3.5" y="11" width="17" height="6.5" rx="1.6" />
      <path d="M9 6V4.5h6V6" />
      <circle cx="7.5" cy="17.8" r="1.1" />
      <circle cx="16.5" cy="17.8" r="1.1" />
    </svg>
  );
}

export function SignalIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="8" y="3" width="8" height="18" rx="3" />
      <circle cx="12" cy="7.5" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="16.5" r="1.6" />
    </svg>
  );
}

export function RouteIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="5.5" cy="18.5" r="2" />
      <circle cx="18.5" cy="5.5" r="2" />
      <path d="M7.5 17.5c4-1 6-3 8-9" />
      <path d="M11 6h-3a2.5 2.5 0 0 0 0 5h4a2.5 2.5 0 0 1 0 5h-1" strokeDasharray="0.1 3" />
    </svg>
  );
}

export function PulseIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 12h4l2-5 4 12 2-7h6" />
    </svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function GaugeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 15a8 8 0 0 1 16 0" />
      <path d="M12 15l4-4" />
      <circle cx="12" cy="15" r="1" />
    </svg>
  );
}

export function UsersIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.5a3 3 0 0 1 0 5.8M17 13.5a5.5 5.5 0 0 1 3.5 5" />
    </svg>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3l7 2.5v5c0 4.6-3 8-7 9.5-4-1.5-7-4.9-7-9.5v-5L12 3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

export function PinIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.6" />
    </svg>
  );
}

export function FlagIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 21V4" />
      <path d="M5 5h11l-2 3 2 3H5" />
    </svg>
  );
}

export function ArrowRight(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function BoltIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M13 3 5 13h6l-1 8 8-10h-6l1-8z" />
    </svg>
  );
}

export function LogoMark(props: IconProps) {
  return (
    <svg width={28} height={28} viewBox="0 0 28 28" fill="none" {...props}>
      <rect x="1.5" y="1.5" width="25" height="25" rx="7.5" className="fill-brand" />
      {/* Minimal route / waypoint mark in the brand foreground colour. */}
      <circle cx="9.5" cy="18.5" r="2.1" className="fill-brand-fg" />
      <circle cx="18.5" cy="9.5" r="2.1" className="fill-brand-fg" />
      <path
        d="M11.4 17.2c3-1.1 4.7-2.8 5.8-5.8"
        className="stroke-brand-fg"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
