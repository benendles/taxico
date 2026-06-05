import { defineConfig } from "tsup";

// Bundle the @taxico/shared workspace source into the service output so the built
// dist runs on plain Node without the workspace symlink.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  clean: true,
  noExternal: ["@taxico/shared"],
});
