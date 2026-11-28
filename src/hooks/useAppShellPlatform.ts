import { useMemo } from 'react'
import { createRemoteVaultBackend } from '../../packages/collab-client/src/remoteVaultBackend'
import { resolvePlatformCapabilities } from '../lib/platformCapabilities'
import { isTauri } from '../mock-tauri'
import { isWebBuild } from '../utils/webBuild'

/** The remote server the web build talks to, when one is configured on window. */
function remoteVaultConfig(): { baseUrl: string; token: string } | null {
  if (typeof window === 'undefined') return null
  const { TOLARIA_REMOTE_URL: baseUrl, TOLARIA_REMOTE_TOKEN: token } = window as {
    TOLARIA_REMOTE_URL?: string
    TOLARIA_REMOTE_TOKEN?: string
  }
  return baseUrl && token ? { baseUrl, token } : null
}

function resolveShellPlatformCapabilities() {
  if (isTauri()) return resolvePlatformCapabilities('tauri')
  return resolvePlatformCapabilities(remoteVaultConfig() ? 'remote' : 'mock')
}

export function useAppShellPlatform() {
  const platformCapabilities = useMemo(() => resolveShellPlatformCapabilities(), [])
  const { perNoteEditors } = platformCapabilities
  const vaultBackend = useMemo(() => {
    if (!perNoteEditors) return null
    const remote = remoteVaultConfig()
    return remote ? createRemoteVaultBackend(remote) : null
  }, [perNoteEditors])
  const showDesktopSidebarChrome = !isWebBuild() && !perNoteEditors
  return { platformCapabilities, vaultBackend, showDesktopSidebarChrome }
}
