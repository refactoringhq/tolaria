// Runs a TypeScript entry point of the server under Node:
//
//   node --experimental-strip-types apps/server/scripts/run.ts <entry.ts> [arguments]
//
// The entry point is bundled first (`bundle.ts`, every package left external) and then imported.
// The container image runs bundles built ahead of time instead (`build-image.ts`).
import { mkdir } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { bundle } from './bundle.ts'

const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url))
const OUT_DIR = join(REPO_ROOT, 'node_modules', '.tmp', 'tolaria-server')

async function main(): Promise<void> {
  const [entry, ...args] = process.argv.slice(2)
  if (!entry) throw new Error('usage: run.ts <entry.ts> [arguments]')
  const outfile = join(OUT_DIR, `${basename(entry, '.ts')}.mjs`)
  await mkdir(OUT_DIR, { recursive: true })
  await bundle(resolve(entry), outfile, 'dev')
  process.argv = [process.argv[0], outfile, ...args]
  await import(pathToFileURL(outfile).href)
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
