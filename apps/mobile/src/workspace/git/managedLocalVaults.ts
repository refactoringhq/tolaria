import { parseOptionalManagedVaultAlias } from './managedVaultAlias'

export type ManagedLocalVault = { id: string; label: string; directory: string; alias?: string }

export function isManagedLocalDirectory(value: string) {
  return value === 'Tolaria Vault' || /^Local Vaults\/[a-z0-9-]{1,80}$/u.test(value)
}

export function parseManagedLocalVaults(value: unknown): ManagedLocalVault[] {
  if (!Array.isArray(value)) throw new Error('vaultCatalogInvalid')
  const vaults = value.map(parseLocalVault)
  if (new Set(vaults.map(vault => vault.id)).size !== vaults.length) throw new Error('vaultCatalogInvalid')
  return vaults
}

function parseLocalVault(entry: unknown): ManagedLocalVault {
  if (!entry || typeof entry !== 'object') throw new Error('vaultCatalogInvalid')
  const value = entry as Partial<ManagedLocalVault>
  const id = managedLocalVaultId(value.id)
  const label = requiredText(value.label)
  const directory = managedLocalDirectory(value.directory)
  const alias = parseOptionalManagedVaultAlias(value.alias, 'vaultCatalogInvalid')
  return { id, label, directory, ...(alias ? { alias } : {}) }
}

function managedLocalVaultId(value: unknown): string {
  const id = requiredText(value)
  if (!/^[a-z0-9-]{1,80}$/u.test(id)) throw new Error('vaultCatalogInvalid')
  return id
}

function managedLocalDirectory(value: unknown): string {
  const directory = requiredText(value)
  if (!isManagedLocalDirectory(directory)) throw new Error('vaultCatalogInvalid')
  return directory
}

function requiredText(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('vaultCatalogInvalid')
  return value
}
