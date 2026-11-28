import type { ReactNode } from 'react'
import { StartupScreen, type StartupScreenParams } from './StartupScreen'
import { StartupShellFallback } from './StartupShellFallback'

interface AppWorkspaceStartupProps {
  initialLoadComplete: boolean
  vaultContentLoading: boolean
  showStartupScreen: boolean
  startup: StartupScreenParams
  children: ReactNode
}

export function AppWorkspaceStartup({
  initialLoadComplete, vaultContentLoading, showStartupScreen, startup, children,
}: AppWorkspaceStartupProps) {
  if (!initialLoadComplete && vaultContentLoading) return <StartupShellFallback />
  if (showStartupScreen) return <StartupScreen {...startup} />
  return children
}
