export const GETTING_STARTED_VAULT_NAME = 'Getting Started'

const CLONE_PATH_ERRORS = [
  'already exists and is not empty',
  'already exists and is not a directory',
  'Failed to create parent directory',
  'Target path is required',
]

const GIT_NOT_FOUND_ERRORS = [
  'no such file or directory',
  'os error 2',
  'program not found',
  'system cannot find the file',
]

const NETWORK_ERRORS = [
  'could not resolve host',
  'connection refused',
  'network is unreachable',
  'timed out',
  'failed to connect',
  'ssl connect error',
]

const AUTH_ERRORS = [
  'authentication failed',
  'could not read username',
  'permission denied',
  'repository not found',
  '403',
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

  const lower = message.toLowerCase()
  if (GIT_NOT_FOUND_ERRORS.some(fragment => lower.includes(fragment))) {
    return 'Git is required to download the Getting Started vault. Install Git and try again.'
  }
  if (AUTH_ERRORS.some(fragment => lower.includes(fragment))) {
    return 'Could not download Getting Started vault. Check your GitHub access and try again.'
  }
  if (NETWORK_ERRORS.some(fragment => lower.includes(fragment))) {
    return 'Could not download Getting Started vault. Check your connection and try again.'
  }

  return `Could not download Getting Started vault: ${firstCloneErrorLine(message)}`
}

function firstCloneErrorLine(message: string): string {
  return message
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(Boolean) ?? 'git reported an unknown error'
}
