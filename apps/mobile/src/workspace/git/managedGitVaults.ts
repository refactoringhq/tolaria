import { githubRepositoryUrl } from './githubRepositoryUrl'

export type ManagedGitVault = { id: string; label: string; repositoryUrl: string }
export type ManagedGitVaultCatalog = { vaults: ManagedGitVault[]; activeId: string | null }

export function parseManagedGitVaultCatalog(serialized: string | null): ManagedGitVaultCatalog {
  if (serialized === null) return { vaults: [], activeId: null }
  try {
    const value: unknown = JSON.parse(serialized)
    if (!isRecord(value)) throw new Error('invalid')
    const vaults = parseVaultList(value.vaults)
    const active = vaults.find((vault) => vault.id === value.activeId)
    return { vaults, activeId: active ? active.id : null }
  } catch {
    throw new Error('vaultCatalogInvalid')
  }
}

function parseVaultList(value: unknown) {
  if (!Array.isArray(value)) throw new Error('invalid')
  const vaults = value.map(parseVault)
  if (new Set(vaults.map((vault) => vault.id)).size !== vaults.length) throw new Error('duplicate')
  return vaults
}

export function isManagedVaultId(id: string) {
  return /^[a-z0-9-]{1,80}$/u.test(id)
}

function parseVault(value: unknown): ManagedGitVault {
  if (!isRecord(value)) throw new Error('invalid')
  const id = requiredText(value.id)
  if (!isManagedVaultId(id)) throw new Error('invalid')
  return { id, label: requiredText(value.label), repositoryUrl: githubRepositoryUrl(requiredText(value.repositoryUrl)) }
}

function requiredText(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('invalid')
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
