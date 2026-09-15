import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/next.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  target: "node18",
  sourcemap: true,
  // Peers — never bundle these; the consumer provides them.
  external: ["@fuma-comment/server", "next"],
});
