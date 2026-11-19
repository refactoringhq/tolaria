// How the server's TypeScript entry points are bundled, for the dev runner (`run.ts`) and the
// container image (`build-image.ts`) alike.
//
// The server shares the markdown pipeline in `src/` with the app, and that code is written for a
// bundler (imports without extensions, `import.meta.env`), so every entry point goes through
// esbuild. The two callers differ only in what stays outside the bundle:
//
// - `dev`: every package stays external and is loaded from the repository's `node_modules`.
// - `image`: every package is bundled except SHIPPED_PACKAGES, which the image installs as real
//   packages because they cannot run from inside a bundle.
import { type BuildOptions, build, type Metafile } from 'esbuild'

/**
 * Packages the image ships in `node_modules` instead of bundling.
 *
 * - `jsdom` reads `browser/default-stylesheet.css` relative to `__dirname` and resolves
 *   `./xhr-sync-worker.js` with `require.resolve` while its modules load, so a bundled copy
 *   throws at start-up.
 */
export const SHIPPED_PACKAGES = ['jsdom'] as const

export type BundleMode = 'dev' | 'image'

const VITE_ENV = JSON.stringify({ MODE: 'production', DEV: false, PROD: true, SSR: true })

// Bundled CommonJS packages call `require` for Node built-ins; an ES module has none of its own.
const REQUIRE_SHIM = "import { createRequire as __tolariaCreateRequire } from 'node:module'; const require = __tolariaCreateRequire(import.meta.url);"

function modeOptions(mode: BundleMode): BuildOptions {
  if (mode === 'dev') return { packages: 'external' }
  return {
    external: [...SHIPPED_PACKAGES],
    banner: { js: REQUIRE_SHIM },
    // Stack traces point at the original files and lines (`node --enable-source-maps`) without
    // shipping the sources themselves.
    sourcemap: 'linked',
    sourcesContent: false,
    metafile: true,
  }
}

export function bundleOptions(entry: string, outfile: string, mode: BundleMode): BuildOptions {
  return {
    entryPoints: [entry],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    // The `paths` of the TypeScript config are for the type checker; resolution follows Node.
    tsconfigRaw: {},
    jsx: 'automatic',
    define: { 'import.meta.env': VITE_ENV },
    logLevel: 'warning',
    ...modeOptions(mode),
  }
}

/** The Yjs builds a bundle contains; more than one means two Yjs instances in one process. */
export function yjsBuilds(metafile: Metafile): string[] {
  return Object.keys(metafile.inputs).filter((input) => /\/node_modules\/yjs\/dist\//.test(input))
}

export async function bundle(entry: string, outfile: string, mode: BundleMode): Promise<Metafile | undefined> {
  const result = await build(bundleOptions(entry, outfile, mode))
  return result.metafile
}
