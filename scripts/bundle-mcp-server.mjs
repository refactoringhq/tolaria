/**
 * Bundle the mcp-server Node.js files into self-contained CJS bundles
 * that can be shipped as Tauri resources inside the .app bundle.
 *
 * Output: src-tauri/resources/mcp-server/{index.js,ws-bridge.js}
 */
import { build } from 'esbuild'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { mkdirSync, writeFileSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SRC = join(ROOT, 'mcp-server')
const OUT = join(ROOT, 'src-tauri', 'resources', 'mcp-server')

mkdirSync(OUT, { recursive: true })

// Tell Node.js that this directory contains CJS bundles, even if the
// root package.json declares "type": "module".
writeFileSync(join(OUT, 'package.json'), JSON.stringify({ type: 'commonjs' }))

const shared = {
  platform: 'node',
  bundle: true,
  format: 'cjs',
  target: 'node18',
  // Mark optional native bindings as external — ws works fine without them
  external: ['bufferutil', 'utf-8-validate'],
  logLevel: 'warning',
}

await build({
  ...shared,
  entryPoints: [join(SRC, 'index.js')],
  outfile: join(OUT, 'index.js'),
})

await build({
  ...shared,
  entryPoints: [join(SRC, 'ws-bridge.js')],
  outfile: join(OUT, 'ws-bridge.js'),
})

console.log('mcp-server bundled → src-tauri/resources/mcp-server/')
