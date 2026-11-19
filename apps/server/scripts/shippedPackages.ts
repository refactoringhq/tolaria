// Copies the packages the image cannot bundle (SHIPPED_PACKAGES in `bundle.ts`) out of the
// repository's pnpm `node_modules`, with exactly the dependency versions the lockfile installed.
//
// pnpm keeps every package in `node_modules/.pnpm/<id>/node_modules/<name>`, next to symlinks to
// the packages it depends on. The closure of a package is every `.pnpm/<id>` reachable through
// those symlinks; copying those directories with their relative symlinks intact, plus a top-level
// link per shipped package, gives Node a working, minimal `node_modules`.
import { cp, mkdir, readdir, realpath, symlink } from 'node:fs/promises'
import { join, relative } from 'node:path'

const STORE_ENTRY = /\/node_modules\/\.pnpm\/([^/]+)\/node_modules\//

/** The `.pnpm/<id>` a package directory lives in. */
async function storeIdOf(packageDir: string): Promise<string> {
  const real = await realpath(packageDir)
  const id = STORE_ENTRY.exec(`${real}/`)?.[1]
  if (id === undefined) throw new Error(`${packageDir} is not in a pnpm store (node_modules/.pnpm); install with pnpm`)
  return id
}

/** Every package directory linked from a store entry: the package itself and its dependencies. */
async function linkedPackageDirs(storeModules: string): Promise<string[]> {
  const dirs: string[] = []
  for (const entry of await readdir(storeModules)) {
    if (!entry.startsWith('@')) {
      dirs.push(join(storeModules, entry))
      continue
    }
    for (const scoped of await readdir(join(storeModules, entry))) dirs.push(join(storeModules, entry, scoped))
  }
  return dirs
}

/** The `.pnpm/<id>` entries the named top-level packages need at run time, sorted. */
export async function shippedStoreIds(nodeModules: string, names: readonly string[]): Promise<string[]> {
  const found = new Set<string>()
  const pending = await Promise.all(names.map((name) => storeIdOf(join(nodeModules, name))))
  while (pending.length > 0) {
    const id = pending.pop() as string
    if (found.has(id)) continue
    found.add(id)
    for (const dir of await linkedPackageDirs(join(nodeModules, '.pnpm', id, 'node_modules'))) {
      pending.push(await storeIdOf(dir))
    }
  }
  return [...found].sort()
}

/** Writes a `node_modules` holding only the named packages and their dependencies into `target`. */
export async function copyShippedPackages(nodeModules: string, names: readonly string[], target: string): Promise<string[]> {
  const ids = await shippedStoreIds(nodeModules, names)
  for (const id of ids) {
    await cp(join(nodeModules, '.pnpm', id), join(target, '.pnpm', id), { recursive: true, verbatimSymlinks: true })
  }
  for (const name of names) {
    const link = join(target, name)
    const packageDir = join(target, '.pnpm', await storeIdOf(join(nodeModules, name)), 'node_modules', name)
    await mkdir(join(link, '..'), { recursive: true })
    await symlink(relative(join(link, '..'), packageDir), link)
  }
  return ids
}
