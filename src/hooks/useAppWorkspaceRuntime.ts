import { useCallback, useMemo } from 'react'
import { areGitFeaturesEnabled } from '../lib/gitSettings'
import { buildVaultAiGuidanceRefreshKey } from '../lib/vaultAiGuidance'
import type { GitSetupPreference, Settings } from '../types'
import { activeGitRepositories } from '../utils/gitRepositories'
import { useGitRepositories } from './useGitRepositories'
import { useGitSetupState } from './useGitSetupState'
import { useVaultAiGuidanceStatus } from './useVaultAiGuidanceStatus'
import { useVaultConfig } from './useVaultConfig'
import { useVaultLoader } from './useVaultLoader'
import type { useVaultSwitcher } from './useVaultSwitcher'
import { useWorkspaceGraphState } from './useWorkspaceGraphState'

interface AppWorkspaceOptions {
  resolvedPath: string
  vaultSwitcher: ReturnType<typeof useVaultSwitcher>
  settings: Settings
  secondaryWindow: boolean
  gitAvailable: boolean
  onToast: (message: string | null) => void
}

function useWorkspaceGitSetup({ resolvedPath, gitAvailable, settings, secondaryWindow, onToast }: AppWorkspaceOptions) {
  const { config: vaultConfig, updateConfig } = useVaultConfig(resolvedPath)
  const gitFeaturesEnabled = gitAvailable && areGitFeaturesEnabled(settings)
  const automaticGitEnabled = gitFeaturesEnabled && !secondaryWindow
  const handlePreferenceChange = useCallback((preference: GitSetupPreference) => {
    updateConfig('git_setup_preference', preference)
  }, [updateConfig])

  const setup = useGitSetupState({
    gitSetupPreference: vaultConfig.git_setup_preference,
    onGitSetupPreferenceChange: handlePreferenceChange,
    onToast,
    resolvedPath,
    windowMode: secondaryWindow,
  })
  return { setup, vaultConfig, updateConfig, gitFeaturesEnabled, automaticGitEnabled }
}

function useAppGitRepositories(graph: ReturnType<typeof useWorkspaceGraphState>, options: AppWorkspaceOptions, enabled: boolean) {
  const { graphDefaultWorkspacePath, multiWorkspaceEnabled } = graph
  const { allVaults } = options.vaultSwitcher
  const gitRepositories = useMemo(() => activeGitRepositories({
    defaultVaultPath: graphDefaultWorkspacePath,
    multiWorkspaceEnabled,
    vaults: allVaults,
  }), [allVaults, graphDefaultWorkspacePath, multiWorkspaceEnabled])
  const activeGitRepositoryPaths = useMemo(() => gitRepositories.map((repository) => repository.path), [gitRepositories])
  const gitSurfaces = useGitRepositories({ defaultVaultPath: graphDefaultWorkspacePath, enabled, repositories: gitRepositories })

  return { gitRepositories, activeGitRepositoryPaths, gitSurfaces }
}

export function useAppWorkspaceRuntime(options: AppWorkspaceOptions) {
  const { resolvedPath, settings, secondaryWindow, vaultSwitcher } = options
  const { allVaults, defaultWorkspacePath, loaded } = vaultSwitcher
  const graph = useWorkspaceGraphState({
    allVaults,
    defaultWorkspacePath,
    resolvedPath,
    settings,
    vaultSwitcherLoaded: loaded,
    windowMode: secondaryWindow,
  })
  const git = useWorkspaceGitSetup(options)
  const vault = useVaultLoader(
    loaded ? resolvedPath : '',
    graph.graphVaults,
    graph.multiWorkspaceEnabled ? defaultWorkspacePath : null,
    graph.folderVaults,
    { loadModifiedFiles: git.automaticGitEnabled },
  )
  const repositories = useAppGitRepositories(graph, options, git.automaticGitEnabled)

  return { graph, git, vault, ...repositories }
}

export function useAppVaultAiGuidance(enabled: boolean, vaultPath: string, entries: ReturnType<typeof useVaultLoader>['entries']) {
  return useVaultAiGuidanceStatus(enabled ? vaultPath : null, buildVaultAiGuidanceRefreshKey(entries))
}
