import type { useAppWorkspaceRuntime } from '../hooks/useAppWorkspaceRuntime'
import type { useAppVaultStartup } from '../hooks/useAppVaultStartup'

type WorkspaceRuntime = ReturnType<typeof useAppWorkspaceRuntime>
type VaultSwitcher = ReturnType<typeof useAppVaultStartup>['vaultSwitcher']

export function noteWorkspaceContext(
  { graph, vault }: Pick<WorkspaceRuntime, 'graph' | 'vault'>,
  { defaultWorkspacePath, loaded }: Pick<VaultSwitcher, 'defaultWorkspacePath' | 'loaded'>,
  resolvedPath: string,
) {
  return {
    noteCreationScope: {
      defaultWorkspacePath: graph.multiWorkspaceEnabled ? defaultWorkspacePath : null,
      vaults: graph.graphVaults ?? [],
    },
    noteLocationLoading: vault.isLoading || !loaded || !resolvedPath,
  }
}

export function workspaceGitAvailability(
  { automaticGitEnabled, gitFeaturesEnabled, setup }: WorkspaceRuntime['git'],
  repositoryPaths: string[],
) {
  return {
    canAutoSync: automaticGitEnabled && setup.gitRepoState === 'ready',
    automaticVaultPaths: automaticGitEnabled ? repositoryPaths : [],
    isGitVault: gitFeaturesEnabled && setup.gitRepoState !== 'missing',
  }
}
