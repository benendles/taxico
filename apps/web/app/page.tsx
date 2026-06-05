import Link from "next/link";
import {
  ArrowRight,
  BoltIcon,
  ClockIcon,
  GaugeIcon,
  LogoMark,
  PulseIcon,
  RouteIcon,
  SignalIcon,
  TaxiMark,
} from "@/components/icons";
import { ThemeToggle } from "@/components/ThemeToggle";

const PILLARS = [
  {
    icon: TaxiMark,
    title: "For drivers",
    body: "Read live traffic, follow the most profitable corridor, and move toward the neighbourhoods where passengers are actually waiting.",
  },
  {
    icon: ClockIcon,
    title: "For passengers",
    body: "Before you step out, know how many taxis pass your route and roughly how long you will wait. No guessing at the roadside.",
  },
  {
    icon: SignalIcon,
    title: "For the city",
    body: "A live picture of congestion and demand across Yaoundé, so transport runs measurably more efficiently.",
  },
];

const FEATURES = [
  { icon: SignalIcon, title: "Real-time tracking", body: "Driver positions stream in every few seconds onto a live interactive map." },
  { icon: GaugeIcon, title: "Traffic detection", body: "Congestion is detected from taxi speed and density, then marked on the map as it forms." },
  { icon: RouteIcon, title: "Route recommendation", body: "Routes are scored on travel time, traffic, taxi saturation and passenger opportunity." },
  { icon: ClockIcon, title: "Availability forecasting", body: "Accepted-route history forecasts taxi availability and waiting time along a passenger's path." },
  { icon: PulseIcon, title: "Opportunity zones", body: "Opportunity score (passenger density over taxi density) surfaces the most profitable areas." },
  { icon: BoltIcon, title: "Live notifications", body: "Drivers are alerted when congestion appears or a higher-opportunity zone opens up." },
];

const ARCHITECTURE = [
  { name: "API Gateway", note: "Single entry, auth, routing" },
  { name: "Auth Service", note: "JWT and accounts" },
  { name: "Traffic Service", note: "Simulation and Socket.IO" },
  { name: "Route Service", note: "Recommendation engine" },
  { name: "Prediction Service", note: "Availability forecasting" },
  { name: "PostgreSQL, Redis", note: "Persistence and cache" },
];

const CRITERIA = [
  "Drivers spend less time stuck in traffic",
  "Drivers are guided toward higher-opportunity zones",
  "Passengers can estimate taxi availability accurately",
  "Route recommendations improve city-wide efficiency",
];

export default function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex h-16 max-w-[1180px] items-center px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <LogoMark />
          <span className="font-display text-[17px] font-bold tracking-tight">Taxico</span>
        </Link>
        <nav className="ml-auto flex items-center gap-3">
          <ThemeToggle />
          <Link href="/login" className="text-sm text-muted transition hover:text-ink">
            Sign in
          </Link>
          <Link href="/register" className="btn-primary px-4 py-1.5 text-xs">
            Get started
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-[1180px] px-6 pb-16 pt-14 md:pt-20">
        <div className="animate-fade-up inline-flex items-center rounded-full border border-hairline bg-surface px-3 py-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Yaoundé, Cameroon</span>
        </div>
        <h1
          className="animate-fade-up mt-6 max-w-3xl font-display text-[44px] font-bold leading-[1.04] tracking-tight md:text-[68px]"
          style={{ animationDelay: "60ms" }}
        >
          Know the road <span className="text-brand">before you drive it.</span>
        </h1>
        <p
          className="animate-fade-up mt-6 max-w-2xl text-lg leading-relaxed text-muted"
          style={{ animationDelay: "120ms" }}
        >
          Taxico is not a ride-hailing app. It is the transportation intelligence layer beneath the
          city&apos;s taxis. It predicts traffic, taxi availability and the most profitable routes in
          real time.
        </p>
        <div className="animate-fade-up mt-9 flex flex-wrap gap-3" style={{ animationDelay: "180ms" }}>
          <Link href="/driver" className="btn-primary">
            Open driver dashboard <ArrowRight width={16} />
          </Link>
          <Link href="/passenger" className="btn-ghost">
            Explore as a passenger
          </Link>
        </div>

        {/* Stat strip */}
        <div
          className="animate-fade-up mt-16 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline md:grid-cols-4"
          style={{ animationDelay: "240ms" }}
        >
          {[
            { k: "10", l: "corridors modelled" },
            { k: "140", l: "taxis tracked live" },
            { k: "11", l: "demand zones scored" },
            { k: "< 3s", l: "route computation" },
          ].map((s) => (
            <div key={s.l} className="bg-surface px-6 py-7">
              <div className="stat-value text-brand">{s.k}</div>
              <div className="mt-2 font-mono text-[11px] uppercase tracking-widest text-faint">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Pillars */}
      <section className="mx-auto max-w-[1180px] px-6 py-10">
        <div className="panel grid divide-y divide-hairline md:grid-cols-3 md:divide-x md:divide-y-0">
          {PILLARS.map((p) => (
            <div key={p.title} className="p-8">
              <div className="flex items-center gap-3 text-brand">
                <p.icon width={20} height={20} />
                <h3 className="font-display text-lg font-semibold text-ink">{p.title}</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-[1180px] px-6 py-12">
        <h2 className="max-w-2xl font-display text-3xl font-bold tracking-tight md:text-[40px]">
          Everything the city needs to move smarter.
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="group panel card-hover p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-hairline bg-surface text-brand transition group-hover:border-brand/40">
                <f.icon width={20} height={20} />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Architecture */}
      <section className="mx-auto max-w-[1180px] px-6 py-12">
        <div className="panel overflow-hidden">
          <div className="border-b border-hairline px-8 py-7">
            <p className="eyebrow">Architecture</p>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-tight">
              A microservice for every concern.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
              A Next.js client talks to a single API Gateway, which routes to four focused services
              over their own ports and streams live data over Socket.IO.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-px bg-hairline md:grid-cols-3">
            {ARCHITECTURE.map((a, i) => (
              <div key={a.name} className="bg-surface px-6 py-5">
                <span className="font-mono text-[11px] text-faint">{String(i + 1).padStart(2, "0")}</span>
                <div className="mt-1 font-display text-sm font-semibold">{a.name}</div>
                <div className="mt-0.5 text-xs text-muted">{a.note}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Success criteria */}
      <section className="mx-auto max-w-[1180px] px-6 py-12">
        <div className="panel overflow-hidden">
          <div className="grid md:grid-cols-[1.1fr_1fr]">
            <div className="border-hairline p-9 md:border-r">
              <p className="eyebrow">Success criteria</p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">
                Measured by movement, not by bookings.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-muted">
                Taxico deliberately stays out of the transaction. Its only job is to make every
                driver and passenger decision better-informed than it was a minute ago.
              </p>
            </div>
            <ul className="divide-y divide-hairline">
              {CRITERIA.map((c, i) => (
                <li key={c} className="flex items-center gap-4 px-8 py-5">
                  <span className="font-mono text-sm text-brand">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-sm">{c}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-[1180px] px-6 py-12">
        <div className="flex flex-col items-start justify-between gap-4 border-t border-hairline pt-8 text-sm text-muted md:flex-row md:items-center">
          <div className="flex items-center gap-2.5">
            <LogoMark />
            <span className="font-display font-semibold text-ink">Taxico</span>
            <span className="text-muted">Intelligent traffic &amp; taxi availability for Cameroon</span>
          </div>
          <div className="flex gap-5 font-mono text-[11px] uppercase tracking-widest">
            <Link href="/driver" className="hover:text-brand">Driver</Link>
            <Link href="/passenger" className="hover:text-brand">Passenger</Link>
            <Link href="/admin" className="hover:text-brand">Admin</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
