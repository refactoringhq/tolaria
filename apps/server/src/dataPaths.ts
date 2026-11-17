import { realpathSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'

/**
 * Where the server keeps what is not in the vault's git history, from the environment. Shared
 * by the server and `pnpm run server:token`, which must find the same token file.
 */

type Env = Record<string, string | undefined>

export function envSetting(env: Env, name: string): string | undefined {
  const value = env[name]?.trim()
  return value ? value : undefined
}

/** `TOLARIA_SERVER_DATA_DIR`, `data` in the working directory by default. */
export function dataDirOf(env: Env): string {
  return resolve(envSetting(env, 'TOLARIA_SERVER_DATA_DIR') ?? 'data')
}

export function vaultDirOf(dataDir: string): string {
  return join(dataDir, 'vault')
}

/** Whether `path` is `dir` or anything under it, compared as resolved paths. */
export function isInside(dir: string, path: string): boolean {
  const rest = relative(resolve(dir), resolve(path))
  return rest === '' || (!rest.startsWith('..') && !isAbsolute(rest))
}

const NOT_IN_VAULT = 'TOLARIA_SERVER_TOKENS_FILE must not be inside the vault directory'

/** `path` with every link in its existing part followed; the part that does not exist yet is kept. */
function realPath(path: string): string {
  try {
    return realpathSync(path)
  } catch {
    const parent = dirname(path)
    return parent === path ? path : join(realPath(parent), basename(path))
  }
}

/** Refuses a token file that a link puts inside the vault, once the vault exists. */
export function assertOutsideVault(file: string, vaultDir: string): void {
  if (isInside(realPath(vaultDir), realPath(file))) throw new Error(NOT_IN_VAULT)
}

/**
 * The agent token file: `TOLARIA_SERVER_TOKENS_FILE`, or `tokens.json` in the data directory.
 * Never inside the vault clone, where a commit would publish it.
 */
export function tokensFileOf(env: Env, dataDir: string): string {
  const file = resolve(envSetting(env, 'TOLARIA_SERVER_TOKENS_FILE') ?? join(dataDir, 'tokens.json'))
  if (isInside(vaultDirOf(dataDir), file)) throw new Error(NOT_IN_VAULT)
  return file
}
