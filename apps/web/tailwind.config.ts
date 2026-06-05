import type { Config } from "tailwindcss";

/** rgb() token that respects Tailwind's <alpha-value> so opacity utilities keep working. */
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: token("canvas"),
        surface: token("surface"),
        raised: token("raised"),
        hairline: token("hairline"),
        ink: token("ink"),
        muted: token("muted"),
        faint: token("faint"),
        brand: {
          DEFAULT: token("brand"),
          fg: token("brand-fg"),
          soft: token("brand-soft"),
        },
        free: token("free"),
        moderate: token("moderate"),
        heavy: token("heavy"),
        severe: token("severe"),
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        xl: "0.75rem",
        "2xl": "1rem",
      },
      boxShadow: {
        // Defined but restrained elevation — corporate presence, not flat minimalism.
        card: "0 1px 3px 0 rgb(var(--shadow) / 0.06), 0 6px 16px -8px rgb(var(--shadow) / 0.10)",
        lift: "0 2px 6px 0 rgb(var(--shadow) / 0.07), 0 18px 40px -12px rgb(var(--shadow) / 0.18)",
        header: "0 1px 0 0 rgb(var(--hairline)), 0 6px 18px -12px rgb(var(--shadow) / 0.10)",
        ring: "0 0 0 1px rgb(var(--brand) / 0.35)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.7)", opacity: "0.6" },
          "100%": { transform: "scale(2.2)", opacity: "0" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) both",
        "fade-in": "fade-in 0.5s ease both",
        "pulse-ring": "pulse-ring 2.4s ease-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
