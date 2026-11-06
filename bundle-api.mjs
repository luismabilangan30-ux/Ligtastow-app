// Bundles api/v2/index.ts into a single file for Vercel serverless.
// Runs as part of `pnpm run build`.
import { build } from "vite"
import { resolve } from "node:path"

await build({
  configFile: false,
  build: {
    lib: { entry: resolve("server/vercel/handler.ts"), formats: ["es"] },
    outDir: "api/v2",
    emptyOutDir: false,
    rollupOptions: {
      external: [
        "pg", "@supabase/supabase-js",
        /^node:/,
      ],
      output: { entryFileNames: "index.mjs" },
    },
    minify: false,
    sourcemap: false,
  },
  logLevel: "warn",
})

console.log("✓ api/v2/index.mjs bundled")
