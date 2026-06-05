"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { session } from "@/lib/api";
import { cx } from "@/lib/ui";
import type { ConnectionStatus } from "@/lib/useCityState";
import type { User } from "@/lib/types";
import { LogoMark } from "./icons";
import { ThemeToggle } from "./ThemeToggle";

const NAV: { href: string; label: string }[] = [
  { href: "/driver", label: "Driver" },
  { href: "/passenger", label: "Passenger" },
  { href: "/admin", label: "Admin" },
];

const STATUS_META: Record<ConnectionStatus, { label: string; color: string }> = {
  connecting: { label: "Connecting", color: "#F59E0B" },
  live: { label: "Live", color: "#22C55E" },
  offline: { label: "Offline", color: "#EF4444" },
};

export function Shell({
  user,
  status,
  children,
}: {
  user: User | null;
  status?: ConnectionStatus;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  function signOut() {
    session.clear();
    router.push("/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-hairline bg-canvas/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-6 px-5">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark />
            <span className="font-display text-[17px] font-bold tracking-tight">Taxico</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => {
              const active = pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cx(
                    "relative rounded-lg px-3.5 py-1.5 text-sm transition",
                    active ? "text-ink" : "text-muted hover:text-ink",
                  )}
                >
                  {item.label}
                  {active && <span className="absolute inset-x-3.5 -bottom-[1px] h-[2px] rounded-full bg-brand" />}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {status && (
              <span className="hidden items-center gap-2 rounded-full border border-hairline px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-muted sm:inline-flex">
                <span className="relative flex h-2 w-2">
                  {status === "live" && (
                    <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full" style={{ background: STATUS_META[status].color }} />
                  )}
                  <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: STATUS_META[status].color }} />
                </span>
                {STATUS_META[status].label}
              </span>
            )}
            <ThemeToggle />
            {user ? (
              <div className="flex items-center gap-3">
                <div className="hidden text-right sm:block">
                  <div className="text-sm font-medium leading-tight">{user.name}</div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-faint">{user.role}</div>
                </div>
                <button onClick={signOut} className="btn-subtle px-3 py-1.5 text-xs">
                  Sign out
                </button>
              </div>
            ) : (
              <Link href="/login" className="btn-primary px-4 py-1.5 text-xs">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-5 py-7">{children}</main>
    </div>
  );
}
