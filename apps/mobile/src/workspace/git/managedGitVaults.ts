import { githubRepositoryUrl } from './githubRepositoryUrl'
import { parseManagedLocalVaults, type ManagedLocalVault } from './managedLocalVaults'
import { parseOptionalManagedVaultAlias } from './managedVaultAlias'

export type ManagedGitVault = { id: string; label: string; repositoryUrl: string; alias?: string }
export type ManagedGitVaultCatalog = {
  vaults: ManagedGitVault[]; activeId: string | null
  localVaults?: ManagedLocalVault[]; activeLocalId?: string | null
}

export function parseManagedGitVaultCatalog(serialized: string | null): ManagedGitVaultCatalog {
  if (serialized === null) return { vaults: [], activeId: null }
  try {
    const value: unknown = JSON.parse(serialized)
    if (!isRecord(value)) throw new Error('invalid')
    const vaults = parseVaultList(value.vaults)
    const active = vaults.find((vault) => vault.id === value.activeId)
    const local = parseLocalCatalog(value)
    const catalog = { vaults, activeId: active?.id ?? null, ...local }
    validateCatalogIdentifiers(catalog)
    return catalog
  } catch {
    throw new Error('vaultCatalogInvalid')
  }
}

function validateCatalogIdentifiers(catalog: ManagedGitVaultCatalog) {
  if (catalog.activeId && catalog.activeLocalId) throw new Error('multipleActiveVaults')
  const entries = [...catalog.vaults, ...(catalog.localVaults ?? [])]
  if (new Set(entries.map(vault => vault.id)).size !== entries.length) throw new Error('duplicate')
}

function parseLocalCatalog(value: Record<string, unknown>): Pick<ManagedGitVaultCatalog, 'localVaults' | 'activeLocalId'> {
  if (value.localVaults === undefined) return {}
  const localVaults = parseManagedLocalVaults(value.localVaults)
  const activeLocalId = localVaults.find(vault => vault.id === value.activeLocalId)?.id ?? null
  return { localVaults, activeLocalId }
}

function parseVaultList(value: unknown) {
  if (!Array.isArray(value)) throw new Error('invalid')
  return value.map(parseVault)
}

export function isManagedVaultId(id: string) {
  return /^[a-z0-9-]{1,80}$/u.test(id)
}

function parseVault(value: unknown): ManagedGitVault {
  if (!isRecord(value)) throw new Error('invalid')
  const id = requiredText(value.id)
  if (!isManagedVaultId(id)) throw new Error('invalid')
  const label = requiredText(value.label)
  const alias = parseOptionalManagedVaultAlias(value.alias, 'invalid')
  return { id, label, repositoryUrl: githubRepositoryUrl(requiredText(value.repositoryUrl)), ...(alias ? { alias } : {}) }
}

function requiredText(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('invalid')
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
