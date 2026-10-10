import {
  createDevVaultWorkspaceRepository,
  type DevVaultWorkspaceState,
} from '../workspace/devVaultWorkspaceRepository'
import type {
  ReadOnlyWorkspaceRepository,
  ReadOnlyWorkspaceRequest,
} from '../workspace/readOnlyWorkspaceRepository'

type MobileUiWorkspaceResolutionInput = {
  devVaultState: DevVaultWorkspaceState | null
  persistenceProbeEnabled: boolean
  probeRepository: ReadOnlyWorkspaceRepository
  repositoryRequest: ReadOnlyWorkspaceRequest
  source: NonNullable<ReadOnlyWorkspaceRequest['source']>
}

const fixtureProbeParams = [
  'mobileActionAdapterProbe',
  'mobileCommandPaletteProbe',
  'mobileKeyboardShortcutProbe',
  'sourceSelectionProbe',
  'tableOfContentsProbe',
  'wysiwygAutocompleteProbe',
  'wysiwygExternalLinkProbe',
  'wysiwygFormatCommandProbe',
  'wysiwygInputTransformProbe',
  'wysiwygMarkdownBlockProbe',
  'wysiwygMathEditProbe',
  'wysiwygMutationProbe',
  'wysiwygTableCommandMutationProbe',
  'wysiwygWikilinkInsertProbe',
] as const

const configuredWorkspaceSources = new Map<string, NonNullable<ReadOnlyWorkspaceRequest['source']>>([
  ['dev-vault', 'dev'],
  ['host-vault', 'host'],
  ['local-vault', 'dev'],
  ['native-vault', 'native'],
  ['native', 'native'],
  ['fixture', 'fixture'],
])

export function initialMobileUiNativeSearch({
  initialUrlSearch,
  launchSearch,
}: {
  initialUrlSearch: string
  launchSearch: string
}) {
  return launchSearch || initialUrlSearch
}

export function mobileUiRequestedWorkspaceSource({
  hasDevVaultUrl = false,
  hasNativeWorkspace,
  platform = typeof document === 'undefined' ? 'native' : 'web',
  requestedSource,
  searchParams,
}: {
  hasDevVaultUrl?: boolean
  hasNativeWorkspace: boolean
  platform?: string
  requestedSource: string | null
  searchParams: URLSearchParams
}): NonNullable<ReadOnlyWorkspaceRequest['source']> {
  const qaSource = qaWorkspaceSource(requestedSource, searchParams)
  if (qaSource) return qaSource
  if (shouldUseNativeWorkspace({ hasDevVaultUrl, hasNativeWorkspace, requestedSource })) return 'native'
  if (!requestedSource) return unconfiguredWorkspaceSource(platform, searchParams)
  return configuredWorkspaceSources.get(requestedSource) ?? (platform === 'web' ? 'fixture' : 'native')
}

function shouldUseNativeWorkspace({
  hasDevVaultUrl,
  hasNativeWorkspace,
  requestedSource,
}: {
  hasDevVaultUrl: boolean
  hasNativeWorkspace: boolean
  requestedSource: string | null
}) {
  if (!hasNativeWorkspace) return false
  if (!requestedSource) return true
  return requestedSource === 'dev-vault' && !hasDevVaultUrl
}

function qaWorkspaceSource(
  requestedSource: string | null,
  searchParams: URLSearchParams,
): NonNullable<ReadOnlyWorkspaceRequest['source']> | null {
  if (hasPersistenceProbe(searchParams)) return 'native'
  if (hasFixtureProbe(searchParams)) return 'fixture'
  if (!requestedSource && searchParams.get('layoutProbe') === '1') return 'fixture'
  return null
}

export function resolveMobileUiWorkspace({
  devVaultState,
  persistenceProbeEnabled,
  probeRepository,
  repositoryRequest,
  source,
}: MobileUiWorkspaceResolutionInput) {
  const useDevVault = source === 'dev' && devVaultState !== null && !persistenceProbeEnabled
  const repository = useDevVault
    ? createDevVaultWorkspaceRepository(devVaultState)
    : probeRepository
  const request = persistenceProbeEnabled
    ? { ...repositoryRequest, workspaceIndex: null }
    : repositoryRequest

  return {
    baseSnapshot: repository.readSnapshot(request),
    repository,
  }
}

function hasPersistenceProbe(searchParams: URLSearchParams): boolean {
  return searchParams.get('workspacePersistenceProbe') === '1'
    || searchParams.get('wysiwygPersistenceProbe') === '1'
}

function hasFixtureProbe(searchParams: URLSearchParams): boolean {
  return fixtureProbeParams.some((key) => searchParams.get(key) === '1')
}

function unconfiguredWorkspaceSource(
  platform: string,
  searchParams: URLSearchParams,
): NonNullable<ReadOnlyWorkspaceRequest['source']> {
  if (searchParams.get('layoutProbe') === '1') return 'fixture'
  return platform === 'web' ? 'fixture' : 'native'
}
