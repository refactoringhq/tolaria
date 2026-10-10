import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Linking, StyleSheet, useWindowDimensions, View } from 'react-native'
import { PhoneWorkspace, type PhoneWorkspaceState } from './PhoneWorkspace'
import { TabletWorkspace } from './TabletWorkspace'
import type { TabletTransitionProbeMode } from './tabletWorkspaceTypes'
import { readOnlyWorkspaceRepository, type ReadOnlyWorkspaceRequest } from '../workspace/readOnlyWorkspaceRepository'
import {
  fetchDevVaultWorkspaceState,
  type DevVaultWorkspaceState,
} from '../workspace/devVaultWorkspaceRepository'
import {
  type NativeWorkspaceSelection,
} from '../workspace/nativeWorkspacePicker'
import { useNativeWorkspace } from '../workspace/useNativeWorkspace'
import { MobileVaultDisplayContext } from '../workspace/MobileVaultContext'
import { initialMobileEditorStateFromMode } from './mobileEditorMode'
import {
  nativeSourceSelectionProbeEnabled,
} from '../qa/nativeSourceSelectionProbe'
import {
  nativeWysiwygMutationProbeEnabled,
} from '../qa/nativeWysiwygMutationProbe'
import {
  nativeWysiwygPersistenceProbeEnabled,
} from '../qa/nativeWysiwygPersistenceProbe'
import {
  nativeWysiwygAutocompleteProbeEnabled,
} from '../qa/nativeWysiwygAutocompleteProbe'
import {
  nativeWysiwygFormatCommandProbeEnabled,
} from '../qa/nativeWysiwygFormatCommandProbe'
import {
  nativeWysiwygInputTransformProbeEnabled,
} from '../qa/nativeWysiwygInputTransformProbe'
import {
  nativeWysiwygExternalLinkProbeEnabled,
} from '../qa/nativeWysiwygExternalLinkProbe'
import {
  nativeWysiwygWikilinkInsertProbeEnabled,
} from '../qa/nativeWysiwygWikilinkInsertProbe'
import {
  nativeWysiwygMarkdownBlockProbeEnabled,
} from '../qa/nativeWysiwygMarkdownBlockProbe'
import {
  nativeWysiwygMathEditProbeEnabled,
} from '../qa/nativeWysiwygMathEditProbe'
import {
  nativeWysiwygTableCommandMutationProbeEnabled,
} from '../qa/nativeWysiwygTableCommandMutationProbe'
import {
  nativeWysiwygPersistenceProbeRepository,
  nativeWysiwygPersistenceProbeRequest,
} from '../qa/nativeWysiwygPersistenceProbeRepository'
import {
  nativeWorkspacePersistenceProbeEnabled,
} from '../qa/nativeWorkspacePersistenceProbe'
import {
  nativeWorkspacePersistenceProbeRepository,
  nativeWorkspacePersistenceProbeRequest,
} from '../qa/nativeWorkspacePersistenceProbeRepository'
import {
  nativeTableOfContentsLogLine,
  nativeTableOfContentsProbeContent,
  nativeTableOfContentsProbeEnabled,
  nativeTableOfContentsProbeTitle,
  type NativeTableOfContentsProof,
} from '../qa/nativeTableOfContentsProbe'
import {
  nativeMobileActionAdapterLogLine,
  nativeMobileActionAdapterProbeEnabled,
  nativeMobileActionAdapterProof,
} from '../qa/nativeMobileActionAdapterProbe'
import {
  nativeMobileCommandPaletteProbeEnabled,
} from '../qa/nativeMobileCommandPaletteProbe'
import {
  nativeMobileKeyboardShortcutProbeEnabled,
} from '../qa/nativeMobileKeyboardShortcutProof'
import { nativeMobileLaunchSearch } from '../native/mobileNativeKeyCommands'
import { setMobileLayoutMetricSinkUrl } from '../qa/mobileLayoutProbe'
import type { MobileNote, MobileWorkspaceSnapshot } from '../workspace/mobileWorkspaceModel'
import { mobileSnapshotWithWysiwygMutationProbeContent } from './mobileUiLabWysiwygMutationSnapshot'
import {
  localVaultEditorBlocks,
  localVaultEditorBullets,
  localVaultSnippet,
} from '../workspace/localVaultMarkdown'
import { Text } from '../components/ui/text'
import { mobileText } from '../i18n/mobileText'
import { mobileColors, mobileSpace, mobileType } from '../ui/tokens'
import {
  mobileSnapshotWithRequestedSelectedNote,
  requestedSelectedNoteId,
} from './mobileUiLabSelectedNote'
import { requestedActionSheetQaTarget } from './mobileActionSheetQaTarget'
import { tabletTransitionProbeMode } from './tabletTransitionProbeMode'
import {
  initialMobileUiNativeSearch,
  mobileUiRequestedWorkspaceSource,
  resolveMobileUiWorkspace,
} from './mobileUiLabWorkspaceResolution'
import { mobileWorkspaceKey } from './mobileWorkspaceKey'

type DevVaultLoadState =
  | { status: 'idle' | 'loading' }
  | { message: string; status: 'error' }
  | { state: DevVaultWorkspaceState; status: 'ready' }

export function MobileUiLab() {
  const { width } = useWindowDimensions()
  const isWideEnoughForTablet = width >= 900
  const searchParams = useMobileUiSearchParams()
  const {
    open: openNativeWorkspace,
    restorePending: nativeWorkspaceRestorePending,
    selection: nativeWorkspace,
  } = useNativeWorkspace()
  const workspacePersistenceProbe = nativeWorkspacePersistenceProbeEnabled(searchParams)
  const wysiwygPersistenceProbe = nativeWysiwygPersistenceProbeEnabled(searchParams)
  const workspaceSource = useMobileUiWorkspaceSource({
    nativeWorkspace,
    searchParams,
    workspacePersistenceProbe,
    wysiwygPersistenceProbe,
  })
  const { devVault, devVaultUrl, repository, repositoryRequest, scenarioId, source } = workspaceSource
  const qa = mobileUiQaFlags(searchParams, { wysiwygPersistenceProbe })
  const metricSinkUrl = qa.layoutProbe ? searchParams.get('metricSink') : null
  const actionAdapterProbeRunKey = searchParams.get('qaRun') ?? 'interactive'
  const selectedSnapshot = mobileSnapshotWithRequestedSelectedNote(
    workspaceSource.baseSnapshot,
    requestedSelectedNoteId(searchParams) ?? nativeWorkspace?.selectedNoteId ?? null,
  )
  const snapshot = mobileSnapshotForProbes(selectedSnapshot, {
    tableOfContentsProbe: qa.tableOfContentsProbe,
    wysiwygMutationProbe: qa.wysiwygMutationProbe,
    wysiwygPersistenceProbe,
  })
  const workspaceKey = mobileWorkspaceKey({
    flags: qa,
    qaRun: searchParams.get('qaRun'),
    scenarioId,
    snapshot,
    source,
    workspacePersistenceProbe,
    wysiwygPersistenceProbe,
  })
  const handleOpenNativeVault = useCallback(async () => {
    await openNativeWorkspace(repositoryRequest.vaultRootUri)
  }, [openNativeWorkspace, repositoryRequest.vaultRootUri])
  const handleTableOfContentsScrollProof = useTableOfContentsScrollProof()

  useLayoutEffect(() => {
    setMobileLayoutMetricSinkUrl(metricSinkUrl)
    return () => setMobileLayoutMetricSinkUrl(null)
  }, [metricSinkUrl])
  useMobileActionAdapterProbe({
    devVaultStatus: devVault.status,
    enabled: qa.mobileActionAdapterProbe,
    repositoryRequest,
    runKey: actionAdapterProbeRunKey,
    snapshot,
    source,
  })
  const statusScreen = mobileUiStatusScreen({ devVault, devVaultUrl, nativeWorkspaceRestorePending, source })
  if (statusScreen) return statusScreen

  const sharedProps = {
    ...qa,
    commandPaletteProbe: qa.mobileCommandPaletteProbe,
    keyboardShortcutProbe: qa.mobileKeyboardShortcutProbe,
    onOpenNativeVault: handleOpenNativeVault,
    repository,
    repositoryRequest,
    sourceIdleSave: !editorIdleSaveDisabled(searchParams),
    snapshot,
  }
  return (
    <MobileVaultDisplayContext.Provider value={{ source, rootUri: repositoryRequest.vaultRootUri }}>
      {isWideEnoughForTablet
        ? <TabletWorkspace key={workspaceKey} {...sharedProps} onTableOfContentsScrollProof={qa.tableOfContentsProbe ? handleTableOfContentsScrollProof : undefined} />
        : <PhoneWorkspace key={workspaceKey} {...sharedProps} initialState={currentPhoneState(searchParams)} />}
    </MobileVaultDisplayContext.Provider>
  )
}

function useTableOfContentsScrollProof() {
  return useCallback((proof: NativeTableOfContentsProof) => {
    console.info(nativeTableOfContentsLogLine(proof))
  }, [])
}

function mobileUiStatusScreen({
  devVault,
  devVaultUrl,
  nativeWorkspaceRestorePending,
  source,
}: {
  devVault: DevVaultLoadState
  devVaultUrl: string | null
  nativeWorkspaceRestorePending: boolean
  source: NonNullable<ReadOnlyWorkspaceRequest['source']>
}) {
  if (nativeWorkspaceRestorePending) {
    return <DevVaultStatusScreen state={{ status: 'loading' }} url={null} />
  }
  if (source === 'dev' && devVault.status !== 'ready') {
    return <DevVaultStatusScreen state={devVault} url={devVaultUrl} />
  }
  return null
}

function currentScenarioId(searchParams: URLSearchParams) {
  return searchParams.get('scenario') || envValue('EXPO_PUBLIC_TOLARIA_SCENARIO')
}

function currentPhoneState(searchParams: URLSearchParams): PhoneWorkspaceState {
  const value = searchParams.get('phoneState')

  if (value === 'editor' || value === 'properties' || value === 'sidebar') return value

  return 'list'
}

function currentSnapshotSource(
  searchParams: URLSearchParams,
  nativeWorkspace: NativeWorkspaceSelection | null,
): NonNullable<ReadOnlyWorkspaceRequest['source']> {
  const requestedSource = searchParams.get('source') ?? envValue('EXPO_PUBLIC_TOLARIA_WORKSPACE_SOURCE')
  return mobileUiRequestedWorkspaceSource({
    hasDevVaultUrl: currentDevVaultUrl(searchParams) !== null,
    hasNativeWorkspace: nativeWorkspace !== null,
    requestedSource,
    searchParams,
  })
}

function editorMode(searchParams: URLSearchParams) {
  return searchParams.get('editorMode')
}

function tabletPanelsMode(searchParams: URLSearchParams) {
  return searchParams.get('tabletPanels')
}

function mobileUiQaFlags(
  searchParams: URLSearchParams,
  { wysiwygPersistenceProbe }: { wysiwygPersistenceProbe: boolean },
) {
  const { initialEditorEditing, initialEditorEditingMode } = initialEditorState(searchParams)

  return {
    forceDesktopPanels: tabletPanelsMode(searchParams) === 'all',
    initialCommandPaletteOpen: initialCommandPaletteOpen(searchParams),
    initialActionSheet: requestedActionSheetQaTarget(searchParams),
    initialEditorEditing,
    initialEditorEditingMode,
    mobileCommandPaletteProbe: nativeMobileCommandPaletteProbeEnabled(searchParams),
    mobileKeyboardShortcutProbe: nativeMobileKeyboardShortcutProbeEnabled(searchParams),
    layoutProbe: layoutProbeEnabled(searchParams),
    mobileActionAdapterProbe: nativeMobileActionAdapterProbeEnabled(searchParams),
    sourceSelectionProbe: nativeSourceSelectionProbeEnabled(searchParams),
    tableOfContentsProbe: nativeTableOfContentsProbeEnabled(searchParams),
    tabletTransitionProbe: tabletTransitionProbeEnabled(searchParams),
    wysiwygAutocompleteProbe: nativeWysiwygAutocompleteProbeEnabled(searchParams),
    wysiwygExternalLinkProbe: nativeWysiwygExternalLinkProbeEnabled(searchParams),
    wysiwygFormatCommandProbe: nativeWysiwygFormatCommandProbeEnabled(searchParams),
    wysiwygInputTransformProbe: nativeWysiwygInputTransformProbeEnabled(searchParams),
    wysiwygMarkdownBlockProbe: nativeWysiwygMarkdownBlockProbeEnabled(searchParams),
    wysiwygMathEditProbe: nativeWysiwygMathEditProbeEnabled(searchParams),
    wysiwygMutationProbe: nativeWysiwygMutationProbeEnabled(searchParams) || wysiwygPersistenceProbe,
    wysiwygTableCommandMutationProbe: nativeWysiwygTableCommandMutationProbeEnabled(searchParams),
    wysiwygWikilinkInsertProbe: nativeWysiwygWikilinkInsertProbeEnabled(searchParams),
  }
}

function initialEditorState(searchParams: URLSearchParams) {
  const requestedMode = editorMode(searchParams)
  if (requestedMode) return initialMobileEditorStateFromMode(requestedMode)

  return {
    initialEditorEditing: true,
    initialEditorEditingMode: 'wysiwyg' as const,
  }
}

function mobileRepositoryForProbes({
  workspacePersistenceProbe,
  wysiwygPersistenceProbe,
}: {
  workspacePersistenceProbe: boolean
  wysiwygPersistenceProbe: boolean
}) {
  if (workspacePersistenceProbe) return nativeWorkspacePersistenceProbeRepository(readOnlyWorkspaceRepository)
  if (wysiwygPersistenceProbe) return nativeWysiwygPersistenceProbeRepository(readOnlyWorkspaceRepository)
  return readOnlyWorkspaceRepository
}

function mobileRepositoryRequestForProbes(
  request: ReadOnlyWorkspaceRequest,
  {
    workspacePersistenceProbe,
    wysiwygPersistenceProbe,
  }: {
    workspacePersistenceProbe: boolean
    wysiwygPersistenceProbe: boolean
  },
) {
  if (workspacePersistenceProbe) return nativeWorkspacePersistenceProbeRequest(request)
  if (wysiwygPersistenceProbe) return nativeWysiwygPersistenceProbeRequest(request)
  return request
}

function useMobileUiWorkspaceSource({
  nativeWorkspace,
  searchParams,
  workspacePersistenceProbe,
  wysiwygPersistenceProbe,
}: {
  nativeWorkspace: NativeWorkspaceSelection | null
  searchParams: URLSearchParams
  workspacePersistenceProbe: boolean
  wysiwygPersistenceProbe: boolean
}) {
  const scenarioId = currentScenarioId(searchParams)
  const source = currentSnapshotSource(searchParams, nativeWorkspace)
  const devVaultUrl = currentDevVaultUrl(searchParams)
  const devVault = useDevVaultWorkspaceState(source === 'dev', devVaultUrl)
  const repositoryRequest = mobileRepositoryRequestForProbes({
    scenarioId,
    source,
    vaultAlias: currentVaultAlias(searchParams, nativeWorkspace),
    vaultLabel: currentVaultLabel(searchParams, nativeWorkspace),
    vaultRootUri: currentVaultRootUri(searchParams, nativeWorkspace),
    workspaceIndex: nativeWorkspace?.index,
  }, { workspacePersistenceProbe, wysiwygPersistenceProbe })
  const probeRepository = mobileRepositoryForProbes({ workspacePersistenceProbe, wysiwygPersistenceProbe })
  const { baseSnapshot, repository } = resolveMobileUiWorkspace({
    devVaultState: devVault.status === 'ready' ? devVault.state : null,
    persistenceProbeEnabled: workspacePersistenceProbe || wysiwygPersistenceProbe,
    probeRepository,
    repositoryRequest,
    source,
  })

  return {
    baseSnapshot,
    devVault,
    devVaultUrl,
    repository,
    repositoryRequest,
    scenarioId,
    source,
  }
}

function currentVaultRootUri(
  searchParams: URLSearchParams,
  nativeWorkspace: NativeWorkspaceSelection | null,
): string | null {
  if (nativeWorkspace) return nativeWorkspace.vaultRootUri
  return searchParams.get('vaultUri') || envValue('EXPO_PUBLIC_TOLARIA_NATIVE_VAULT_URI')
}

function currentDevVaultUrl(searchParams: URLSearchParams): string | null {
  return searchParams.get('devVaultUrl') || envValue('EXPO_PUBLIC_TOLARIA_DEV_VAULT_URL')
}

function currentVaultLabel(
  searchParams: URLSearchParams,
  nativeWorkspace: NativeWorkspaceSelection | null,
): string | null {
  if (nativeWorkspace) return nativeWorkspace.vaultLabel
  return searchParams.get('vaultLabel') || envValue('EXPO_PUBLIC_TOLARIA_NATIVE_VAULT_LABEL')
}

function currentVaultAlias(
  searchParams: URLSearchParams,
  nativeWorkspace: NativeWorkspaceSelection | null,
): string | null {
  if (nativeWorkspace) return nativeWorkspace.vaultAlias
  return searchParams.get('vaultAlias') || envValue('EXPO_PUBLIC_TOLARIA_NATIVE_VAULT_ALIAS')
}

function layoutProbeEnabled(searchParams: URLSearchParams) {
  return searchParams.get('layoutProbe') === '1' || envFlagEnabled('EXPO_PUBLIC_TOLARIA_LAYOUT_PROBE')
}

function tabletTransitionProbeEnabled(searchParams: URLSearchParams): TabletTransitionProbeMode {
  return tabletTransitionProbeMode({
    envProbe: envValue('EXPO_PUBLIC_TOLARIA_TABLET_TRANSITION_PROBE'),
    queryProbe: searchParams.get('tabletTransitionProbe'),
  })
}

function editorIdleSaveDisabled(searchParams: URLSearchParams) {
  return searchParams.get('disableEditorIdleSave') === '1'
}

function mobileSnapshotForProbes(
  snapshot: MobileWorkspaceSnapshot,
  {
    tableOfContentsProbe,
    wysiwygMutationProbe,
    wysiwygPersistenceProbe,
  }: {
    tableOfContentsProbe: boolean
    wysiwygMutationProbe: boolean
    wysiwygPersistenceProbe: boolean
  },
) {
  if (tableOfContentsProbe) return snapshotWithTableOfContentsProbeContent(snapshot)
  if (wysiwygMutationProbe && !wysiwygPersistenceProbe) {
    return mobileSnapshotWithWysiwygMutationProbeContent(snapshot)
  }

  return snapshot
}

function snapshotWithTableOfContentsProbeContent(snapshot: MobileWorkspaceSnapshot): MobileWorkspaceSnapshot {
  const selectedNoteId = snapshot.selectedNoteId ?? snapshot.notes[0]?.id
  if (!selectedNoteId) return snapshot

  const rawContent = nativeTableOfContentsProbeContent()
  const editorBlocks = localVaultEditorBlocks(rawContent)
  const editorBullets = localVaultEditorBullets(editorBlocks)
  const seedSelectedNote = (note: MobileNote) => note.id === selectedNoteId
    ? {
        ...note,
        editorBlocks,
        editorBullets,
        rawContent,
        snippet: localVaultSnippet(rawContent),
        title: nativeTableOfContentsProbeTitle(),
      }
    : note

  return {
    ...snapshot,
    allNotes: snapshot.allNotes?.map(seedSelectedNote),
    editorBlocks,
    editorBullets,
    notes: snapshot.notes.map(seedSelectedNote),
    selectedNoteId,
  }
}

function initialCommandPaletteOpen(searchParams: URLSearchParams) {
  return searchParams.get('commandPalette') === '1'
}

function DevVaultStatusScreen({
  state,
  url,
}: {
  state: Exclude<DevVaultLoadState, { status: 'ready' }>
  url: string | null
}) {
  const title = state.status === 'error'
    ? mobileText('ai.workspace.status.error')
    : mobileText('status.vault.reloading')
  const detail = state.status === 'error'
    ? state.message
    : url ?? mobileText('status.vault.reloadingTooltip')

  return (
    <View style={devVaultStyles.root} testID="dev-vault-status">
      <Text style={devVaultStyles.title}>{title}</Text>
      <Text selectable style={devVaultStyles.detail}>{detail}</Text>
    </View>
  )
}

function useDevVaultWorkspaceState(
  enabled: boolean,
  url: string | null,
): DevVaultLoadState {
  const [state, setState] = useState<DevVaultLoadState>({ status: 'idle' })

  useEffect(() => {
    if (!enabled) {
      return scheduleDevVaultState(setState, { status: 'idle' })
    }
    if (!url?.trim()) {
      return scheduleDevVaultState(setState, { message: mobileText('status.vault.devBridgeMissingUrl'), status: 'error' })
    }

    const controller = new AbortController()
    const cancelLoadingState = scheduleDevVaultState(setState, { status: 'loading' })
    void fetchDevVaultWorkspaceState(url, controller.signal)
      .then((nextState) => {
        if (!controller.signal.aborted) setState({ state: nextState, status: 'ready' })
      })
      .catch((error) => {
        if (!controller.signal.aborted) setState({ message: devVaultErrorMessage(error), status: 'error' })
      })

    return () => {
      cancelLoadingState()
      controller.abort()
    }
  }, [enabled, url])

  return state
}

function scheduleDevVaultState(
  setState: (state: DevVaultLoadState) => void,
  state: DevVaultLoadState,
) {
  const timer = setTimeout(() => setState(state), 0)
  return () => clearTimeout(timer)
}

function devVaultErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : mobileText('status.vault.devBridgeFailed')
}

function useMobileActionAdapterProbe({
  devVaultStatus,
  enabled,
  repositoryRequest,
  runKey,
  snapshot,
  source,
}: {
  devVaultStatus: DevVaultLoadState['status']
  enabled: boolean
  repositoryRequest: ReadOnlyWorkspaceRequest
  runKey: string
  snapshot: MobileWorkspaceSnapshot
  source: NonNullable<ReadOnlyWorkspaceRequest['source']>
}) {
  const lastRunKey = useRef<string | null>(null)

  useEffect(() => {
    if (source === 'dev' && devVaultStatus !== 'ready') return
    if (!enabled) return
    if (lastRunKey.current === runKey) return

    lastRunKey.current = runKey
    void nativeMobileActionAdapterProof({ repositoryRequest, snapshot })
      .then((proof) => {
        console.info(nativeMobileActionAdapterLogLine(proof))
      })
      .catch((error) => {
        console.warn('[mobile-action-adapter-probe] Failed to collect proof:', error)
      })
  }, [devVaultStatus, enabled, repositoryRequest, runKey, snapshot, source])
}

function useMobileUiSearchParams() {
  const launchSearch = useMemo(() => nativeMobileLaunchSearch(), [])
  const [nativeSearch, setNativeSearch] = useState(launchSearch)
  const webSearch = currentWebSearch()

  useEffect(() => {
    let mounted = true
    const subscription = Linking.addEventListener('url', ({ url }) => {
      setNativeSearch(searchFromUrl(url))
    })

    Linking.getInitialURL()
      .then((url) => {
        if (!mounted) return
        setNativeSearch((current) => initialMobileUiNativeSearch({
          initialUrlSearch: searchFromUrl(url),
          launchSearch: current,
        }))
      })
      .catch(() => {
        // Keep native launch arguments when iOS cannot resolve its initial URL.
      })

    return () => {
      mounted = false
      subscription.remove()
    }
  }, [])

  return useMemo(
    () => new URLSearchParams(nativeSearch || webSearch || launchSearch),
    [launchSearch, nativeSearch, webSearch],
  )
}

function currentWebSearch() {
  const search = (globalThis as { location?: { search?: string } }).location?.search
  return search ?? ''
}

function searchFromUrl(url: string | null) {
  if (!url) return ''

  const queryStart = url.indexOf('?')
  if (queryStart === -1) return ''

  return url.slice(queryStart)
}

function envFlagEnabled(name: string) {
  return envValue(name) === '1'
}

function envValue(name: string) {
  const processGlobal = globalThis as { process?: { env?: Record<string, string | undefined> } }
  return processGlobal.process?.env?.[name] ?? null
}

const devVaultStyles = StyleSheet.create({
  detail: {
    maxWidth: 520,
    color: mobileColors.textMuted,
    fontSize: mobileType.body,
    lineHeight: 22,
    textAlign: 'center',
  },
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: mobileSpace.sm,
    backgroundColor: mobileColors.app,
    padding: mobileSpace.xxl,
  },
  title: {
    color: mobileColors.text,
    fontSize: mobileType.title,
    fontWeight: '600',
  },
})
