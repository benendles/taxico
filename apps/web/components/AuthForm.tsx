"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, session } from "@/lib/api";
import { cx } from "@/lib/ui";
import { ArrowRight, LogoMark } from "./icons";
import { ThemeToggle } from "./ThemeToggle";

const DEMO = [
  { role: "Driver", email: "driver@taxico.cm", password: "taxico-driver" },
  { role: "Passenger", email: "passenger@taxico.cm", password: "taxico-pass" },
  { role: "Admin", email: "admin@taxico.cm", password: "taxico-admin" },
];

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"driver" | "passenger">("driver");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result =
        mode === "login"
          ? await api.login({ email, password })
          : await api.register({ name, email, password, role });
      session.set(result.token, result.user);
      router.push(`/${result.user.role}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden border-r border-hairline bg-raised p-12 lg:flex">
        <div className="hairline-grid absolute inset-0 [background-size:38px_38px] opacity-70" />
        <div
          className="absolute -right-40 -top-40 h-96 w-96 rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(circle, rgb(var(--brand)) 0%, transparent 70%)" }}
        />
        <Link href="/" className="relative flex items-center gap-2.5">
          <LogoMark />
          <span className="font-display text-[17px] font-bold tracking-tight">Taxico</span>
        </Link>
        <div className="relative">
          <p className="eyebrow">Yaoundé, Cameroon</p>
          <h2 className="mt-4 max-w-md font-display text-[34px] font-bold leading-[1.1] tracking-tight">
            The intelligence layer beneath the city&apos;s taxis.
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">
            Live traffic, taxi availability and the most profitable routes, updated in real time
            across the city.
          </p>
        </div>
        <div className="relative font-mono text-[11px] uppercase tracking-widest text-faint">
          Real-time and predictive, at city scale
        </div>
      </div>

      {/* Form panel */}
      <div className="relative flex items-center justify-center p-6">
        <div className="absolute right-5 top-5">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-sm">
          <h1 className="font-display text-[28px] font-bold tracking-tight">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {mode === "login"
              ? "Sign in to your driver, passenger or admin workspace."
              : "Join Taxico as a driver or a passenger."}
          </p>

          <form onSubmit={submit} className="mt-7 space-y-3">
            {mode === "register" && (
              <input className="field" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required />
            )}
            <input
              className="field"
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              className="field"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {mode === "register" && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                {(["driver", "passenger"] as const).map((r) => (
                  <button
                    type="button"
                    key={r}
                    onClick={() => setRole(r)}
                    className={cx(
                      "rounded-lg border px-4 py-3 text-sm capitalize transition",
                      role === r ? "border-brand/50 bg-brand/8 text-brand" : "border-hairline text-muted hover:text-ink",
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}

            {error && (
              <p className="rounded-lg border border-severe/40 bg-severe/10 px-4 py-3 text-sm text-severe">{error}</p>
            )}

            <button type="submit" disabled={busy} className="btn-primary mt-1 w-full disabled:opacity-60">
              {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
              {!busy && <ArrowRight width={16} />}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-muted">
            {mode === "login" ? (
              <>
                New to Taxico?{" "}
                <Link href="/register" className="text-brand hover:underline">
                  Create an account
                </Link>
              </>
            ) : (
              <>
                Already registered?{" "}
                <Link href="/login" className="text-brand hover:underline">
                  Sign in
                </Link>
              </>
            )}
          </p>

          {mode === "login" && (
            <div className="mt-8 rounded-xl border border-hairline bg-surface p-4">
              <p className="font-mono text-[10px] uppercase tracking-widest text-faint">Demo accounts</p>
              <div className="mt-3 space-y-1">
                {DEMO.map((d) => (
                  <button
                    key={d.email}
                    type="button"
                    onClick={() => {
                      setEmail(d.email);
                      setPassword(d.password);
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs transition hover:bg-raised"
                  >
                    <span className="font-medium text-ink">{d.role}</span>
                    <span className="font-mono text-muted">{d.email}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
