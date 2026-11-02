import { normalizeWorkspaceSlug } from '../../../../src/utils/workspaces'
import { vaultDeepLinkSlug } from '../../../../src/utils/deepLinks'

export type MobileWorkspaceAliasInput = {
  alias?: string | null
  label?: string | null
  path?: string | null
}

export function mobileWorkspaceAlias({
  alias,
  label,
  path,
}: MobileWorkspaceAliasInput): string | null {
  return slugifyMobileWorkspaceAlias(alias)
    ?? slugifyMobileWorkspaceAlias(label)
    ?? slugifyMobileWorkspaceAlias(lastPathSegment(path))
}

export function slugifyMobileWorkspaceAlias(value: unknown): string | null {
  return normalizeWorkspaceSlug(value)
}

export function mobileWorkspaceDeepLinkSlug<T extends { id: string; label: string; alias?: string | null }>(
  vault: T,
  vaults: readonly T[],
): string {
  const deepLinkVaults = vaults.map((entry) => ({ path: entry.id, label: entry.label, alias: entry.alias }))
  const selected = deepLinkVaults.find((entry) => entry.path === vault.id)
  return selected ? vaultDeepLinkSlug(selected, deepLinkVaults) : slugifyMobileWorkspaceAlias(vault.alias ?? vault.label) ?? 'workspace'
}

function lastPathSegment(path: unknown): string {
  return stringValue(path).replace(/\/+$/u, '').split('/').filter(Boolean).at(-1) ?? ''
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}
