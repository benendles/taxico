# Lessons

Accumulated rules derived from this project's work and any corrections.

- **No slop placeholders.** A couple of careless artifacts slipped into first drafts —
  an invalid hex literal as a PRNG seed (`0xta_x`), a stray Cyrillic field name, and a
  non-existent Tailwind class (`font-700`). Re-read generated code for these before
  moving on; they don't surface until build time.
- **Quote object keys containing hyphens** in JS/TS config (`"pulse-ring"`), or the
  parser silently misreads them.
- **Share components instead of duplicating.** `PlaceSelect`/`BootScreen` were briefly
  defined in two pages; lifted into `components/widgets.tsx`.
- **`tsup --noExternal` is not a CLI flag.** It only exists in `tsup.config.ts`
  (`noExternal: ["@taxico/shared"]`). Workspace packages are externalised by default, so a
  build that must run on plain Node has to force-bundle them via config, not the CLI.
- **Renaming design tokens is a breaking change across every file.** Switching the Tailwind
  palette (`taxi`→`brand`, `ink`→`canvas`, `haze`→`muted`…) silently drops styles wherever
  the old class names remain — Tailwind just emits nothing. Grep for every old token before
  declaring a theme migration done.
- **`satisfies T` freezes literal types.** `{ recommended: false } satisfies RouteOption`
  infers `recommended: false`, breaking later mutation. Annotate the variable/return type
  instead when the object will be mutated.
