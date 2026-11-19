import { execFile } from 'node:child_process'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { isBuiltin } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { bundle, bundleOptions, SHIPPED_PACKAGES, yjsBuilds } from '../scripts/bundle.ts'
import { copyShippedPackages, shippedStoreIds } from '../scripts/shippedPackages.ts'

// What the container image runs (scripts/build-image.ts): bundles of the server and the token
// command, and a node_modules with only the packages that cannot be bundled.

const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url))
const NODE_MODULES = join(REPO_ROOT, 'node_modules')
const run = promisify(execFile)

let out: string

beforeAll(async () => {
  out = await mkdtemp(join(tmpdir(), 'tolaria-image-bundle-'))
})

afterAll(async () => {
  await rm(out, { recursive: true, force: true })
})

describe('bundle options', () => {
  it('leaves every package to node_modules for the dev runner', () => {
    expect(bundleOptions('entry.ts', 'out.mjs', 'dev')).toMatchObject({ packages: 'external' })
  })

  it('bundles every package but the shipped ones for the image, with a source map and no sources', () => {
    const options = bundleOptions('entry.ts', 'out.mjs', 'image')
    expect(options.packages).toBeUndefined()
    expect(options.external).toEqual([...SHIPPED_PACKAGES])
    expect(options).toMatchObject({ sourcemap: 'linked', sourcesContent: false })
  })

  it('shares everything else between the two', () => {
    const dev = bundleOptions('entry.ts', 'out.mjs', 'dev')
    const image = bundleOptions('entry.ts', 'out.mjs', 'image')
    for (const [key, value] of Object.entries(dev)) {
      if (key !== 'packages') expect(image[key as keyof typeof image]).toEqual(value)
    }
  })
})

describe('the server bundle', () => {
  it('holds exactly one Yjs build', async () => {
    const metafile = await bundle(join(REPO_ROOT, 'apps/server/src/main.ts'), join(out, 'dist', 'main.mjs'), 'image')
    if (!metafile) throw new Error('an image bundle has a metafile')
    expect(yjsBuilds(metafile)).toHaveLength(1)
    const imports = Object.values(metafile.outputs).flatMap((output) => output.imports)
    const packages = imports.filter((entry) => entry.external && !isBuiltin(entry.path)).map((entry) => entry.path)
    // `ws` tries its optional native add-ons inside a try/catch and falls back to JavaScript; neither is installed.
    expect(new Set(packages)).toEqual(new Set([...SHIPPED_PACKAGES, 'bufferutil', 'utf-8-validate']))
  })

  it('counts every Yjs build it finds', () => {
    const input = { bytes: 1, imports: [] }
    const inputs = {
      'node_modules/.pnpm/yjs@13.6.29/node_modules/yjs/dist/yjs.mjs': input,
      'node_modules/.pnpm/yjs@13.6.29/node_modules/yjs/dist/yjs.cjs': input,
      'packages/markdown-yjs/src/blockPatch.ts': input,
    }
    expect(yjsBuilds({ inputs, outputs: {} })).toHaveLength(2)
  })
})

describe('the token command bundle', () => {
  it('runs from the bundle alone', async () => {
    const outfile = join(out, 'dist', 'token.mjs')
    await bundle(join(REPO_ROOT, 'apps/server/scripts/token.ts'), outfile, 'image')
    const env = { ...process.env, TOLARIA_SERVER_DATA_DIR: join(out, 'data') }
    const { stdout } = await run(process.execPath, [outfile, 'list'], { cwd: out, env })
    expect(stdout).toBe('No tokens.\n')
  })
})

describe('shipped packages', () => {
  it('follow the lockfile closure of jsdom and nothing the bundle has', async () => {
    const ids = await shippedStoreIds(NODE_MODULES, SHIPPED_PACKAGES)
    expect(ids.some((id) => id.startsWith('jsdom@'))).toBe(true)
    expect(ids.some((id) => id.startsWith('parse5@'))).toBe(true)
    expect(ids.some((id) => /^(yjs|@blocknote|react)/.test(id))).toBe(false)
  })

  it('load from the copied node_modules on their own', async () => {
    const target = join(out, 'node_modules')
    await copyShippedPackages(NODE_MODULES, SHIPPED_PACKAGES, target)
    expect(await readdir(target)).toEqual(expect.arrayContaining(['.pnpm', 'jsdom']))
    const script = "const { JSDOM } = require('jsdom'); process.stdout.write(new JSDOM('<p>ok</p>').window.document.querySelector('p').textContent)"
    // Run from the copy, with the repository's node_modules out of reach of Node's resolution.
    const { stdout } = await run(process.execPath, ['-e', script], { cwd: out, env: { ...process.env, NODE_PATH: '' } })
    expect(stdout).toBe('ok')
  }, 60_000)
})
