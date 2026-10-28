import { existsSync } from "node:fs"
import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, type PluginOption } from "vite"

// Two build targets from one source:
// - "tolaria.md": the public site. `vite build --mode tolaria-md` (npm run build:tolaria-md), and the default whenever
//   ../preview is absent (e.g. after this folder is copied into the Tolaria repo). Output: ./dist (copy it over the
//   VitePress output; see IMPORT.md at the tolaria-landing repo root). No service worker, no search-engine opt-out, canonical
//   and share image on https://tolaria.md, docs links relative (/docs, /start/install, ...).
// - "preview": the private preview build. Adds what lives in ../preview (search-engine opt-out, private assets, service worker) and
//   writes ../public for the Worker.
const previewDir = resolve(import.meta.dirname, "../preview")

export default defineConfig(async ({ mode }) => {
  const site = process.env.TOLARIA_SITE ?? (mode === "tolaria-md" || !existsSync(previewDir) ? "tolaria.md" : "preview")
  const isPreview = site === "preview"
  const plugins: PluginOption[] = [react(), tailwindcss()]
  if (isPreview) plugins.push((await import(resolve(previewDir, "vite-plugin.mjs"))).default())
  return {
    plugins,
    define: { __TOLARIA_MD__: JSON.stringify(!isPreview) },
    resolve: {
      alias: {
        "@site-boot": isPreview ? resolve(previewDir, "src/boot.ts") : resolve(import.meta.dirname, "src/site-boot.ts"),
        "@": resolve(import.meta.dirname, "./src"),
      },
    },
    build: { outDir: resolve(import.meta.dirname, isPreview ? "../public" : "dist"), emptyOutDir: true, chunkSizeWarningLimit: 800 },
    server: { proxy: isPreview ? { "/api": "http://localhost:8787" } : undefined },
  }
})
