export const GETTING_STARTED_VAULT_NAME = 'Getting Started'
const LEGACY_GETTING_STARTED_VAULT_NAMES = new Set([
  GETTING_STARTED_VAULT_NAME.toLowerCase(),
  'demo-vault',
  'demo-vault-v2',
])

const CLONE_PATH_ERRORS = [
  'already exists and is not empty',
  'already exists and is not a directory',
  'Failed to create parent directory',
  'Target path is required',
]

export function buildGettingStartedVaultPath(parentPath: string): string {
  const trimmed = parentPath.trim().replace(/[\\/]+$/g, '')
  if (!trimmed) {
    return GETTING_STARTED_VAULT_NAME
  }

  const separator = trimmed.includes('\\') && !trimmed.includes('/') ? '\\' : '/'
  return `${trimmed}${separator}${GETTING_STARTED_VAULT_NAME}`
}

export function labelFromPath(path: string): string {
  const trimmed = path.trim().replace(/[\\/]+$/g, '')
  return trimmed.split(/[\\/]/).pop() || 'Vault'
}

export function isGettingStartedVaultPath(path: string, resolvedDefaultPath?: string | null): boolean {
  if (!path) {
    return false
  }

  if (resolvedDefaultPath && path === resolvedDefaultPath) {
    return true
  }

  return LEGACY_GETTING_STARTED_VAULT_NAMES.has(labelFromPath(path).toLowerCase())
}

export function formatGettingStartedCloneError(err: unknown): string {
  const message =
    typeof err === 'string'
      ? err
      : err instanceof Error
        ? err.message
        : `${err}`

  if (CLONE_PATH_ERRORS.some(fragment => message.includes(fragment))) {
    return message
  }

  return 'Could not download Getting Started vault. Check your connection and try again.'
}
