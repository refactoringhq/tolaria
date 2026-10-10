import type { MobileWorkspaceWrite } from './mobileWorkspaceEditing'

export function normalizedWorkspaceRelativePath(path: string): string | null {
  const normalized = path.replaceAll('\\', '/').trim()
  if (!normalized || unsafePathSyntax(normalized)) return null
  const parts = normalized.split('/').filter(Boolean)
  if (parts.some((part) => part === '.' || part === '..')) return null
  return parts.join('/')
}

function unsafePathSyntax(path: string) {
  return path.startsWith('/') || path.includes('://') || path.includes('\0')
}

export function validateWorkspaceWrites(writes: MobileWorkspaceWrite[]) {
  for (const write of writes) {
    if (write.kind === 'saveVaultConfig') continue
    requireWorkspaceWritePath(write.path)
    if (write.kind === 'moveNote' || write.kind === 'renameFolder') requireWorkspaceWritePath(write.toPath)
  }
}

export function requireWorkspaceWritePath(path: string): string {
  const normalized = normalizedWorkspaceRelativePath(path)
  if (!normalized) throw new Error('invalidWorkspacePath')
  if (normalized.split('/').some((part) => part.toLowerCase() === '.git')) throw new Error('reservedWorkspacePath')
  return normalized
}
