"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

/** Sun/moon toggle with a smooth crossfade micro-interaction. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = mounted ? resolvedTheme === "dark" : true;

  return (
    <button
      type="button"
      aria-label="Toggle colour theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`group relative flex h-9 w-9 items-center justify-center rounded-lg border border-hairline bg-surface text-muted transition hover:text-ink ${className}`}
    >
      <span className="relative h-[18px] w-[18px]">
        {/* Sun */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinecap="round"
          className={`absolute inset-0 transition-all duration-300 ${isDark ? "scale-50 opacity-0 rotate-90" : "scale-100 opacity-100 rotate-0"}`}
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
        {/* Moon */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`absolute inset-0 transition-all duration-300 ${isDark ? "scale-100 opacity-100 rotate-0" : "scale-50 opacity-0 -rotate-90"}`}
        >
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      </span>
    </button>
  );
}
