// Builds what the container image runs (apps/server/Dockerfile), after `pnpm install`:
//
//   node --experimental-strip-types apps/server/scripts/build-image.ts <out-dir>
//
// <out-dir>/dist/main.mjs        the server (apps/server/src/main.ts), with its source map
// <out-dir>/dist/token.mjs       the token command (apps/server/scripts/token.ts)
// <out-dir>/node_modules         only the packages that cannot be bundled (SHIPPED_PACKAGES)
// <out-dir>/bin/tolaria-token    the token command's launcher, for the image's PATH
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { bundle, SHIPPED_PACKAGES, yjsBuilds } from './bundle.ts'
import { copyShippedPackages } from './shippedPackages.ts'

const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url))
const ENTRIES = {
  main: join(REPO_ROOT, 'apps/server/src/main.ts'),
  token: join(REPO_ROOT, 'apps/server/scripts/token.ts'),
}
const TOKEN_LAUNCHER = `#!/bin/sh
# Manages the agent tokens of this Tolaria remote: tolaria-token add|list|revoke (apps/server/README.md).
exec node --enable-source-maps /app/dist/token.mjs "$@"
`

async function bundleEntry(name: string, entry: string, dist: string): Promise<void> {
  const metafile = await bundle(entry, join(dist, `${name}.mjs`), 'image')
  const builds = metafile ? yjsBuilds(metafile) : []
  // Two Yjs instances in one process break document sync, and only at run time.
  if (builds.length > 1) throw new Error(`${name}: more than one Yjs build in the bundle: ${builds.join(', ')}`)
}

async function main(): Promise<void> {
  const [outArg] = process.argv.slice(2)
  if (!outArg) throw new Error('usage: build-image.ts <out-dir>')
  const out = resolve(outArg)
  await rm(out, { recursive: true, force: true })
  const dist = join(out, 'dist')
  await mkdir(dist, { recursive: true })
  for (const [name, entry] of Object.entries(ENTRIES)) await bundleEntry(name, entry, dist)
  const ids = await copyShippedPackages(join(REPO_ROOT, 'node_modules'), SHIPPED_PACKAGES, join(out, 'node_modules'))
  await mkdir(join(out, 'bin'))
  await writeFile(join(out, 'bin', 'tolaria-token'), TOKEN_LAUNCHER, { mode: 0o755 })
  process.stdout.write(`bundled ${Object.keys(ENTRIES).join(', ')}; shipped ${SHIPPED_PACKAGES.join(', ')} (${ids.length} packages)\n`)
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
