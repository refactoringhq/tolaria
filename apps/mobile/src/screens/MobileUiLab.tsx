import { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Linking, StyleSheet, View } from 'react-native'
import { Text } from '../components/ui/text'
import { MobileDeepLinkNotice } from '../components/vaults/MobileDeepLinkNotice'
import { mobileText } from '../i18n/mobileText'
import { nativeMobileLaunchSearch } from '../native/mobileNativeKeyCommands'
import { setMobileLayoutMetricSinkUrl } from '../qa/mobileLayoutProbe'
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
import {
  nativeSourceSelectionProbeEnabled,
} from '../qa/nativeSourceSelectionProbe'
import {
  type NativeTableOfContentsProof,
  nativeTableOfContentsLogLine,
  nativeTableOfContentsProbeContent,
  nativeTableOfContentsProbeEnabled,
  nativeTableOfContentsProbeTitle,
} from '../qa/nativeTableOfContentsProbe'
import {
  nativeWorkspacePersistenceProbeEnabled,
} from '../qa/nativeWorkspacePersistenceProbe'
import {
  nativeWysiwygAutocompleteProbeEnabled,
} from '../qa/nativeWysiwygAutocompleteProbe'
import {
  nativeWysiwygExternalLinkProbeEnabled,
} from '../qa/nativeWysiwygExternalLinkProbe'
import {
  nativeWysiwygFormatCommandProbeEnabled,
} from '../qa/nativeWysiwygFormatCommandProbe'
import {
  nativeWysiwygInputTransformProbeEnabled,
} from '../qa/nativeWysiwygInputTransformProbe'
import {
  nativeWysiwygMarkdownBlockProbeEnabled,
} from '../qa/nativeWysiwygMarkdownBlockProbe'
import {
  nativeWysiwygMathEditProbeEnabled,
} from '../qa/nativeWysiwygMathEditProbe'
import {
  nativeWysiwygMutationProbeEnabled,
} from '../qa/nativeWysiwygMutationProbe'
import {
  nativeWysiwygPersistenceProbeEnabled,
} from '../qa/nativeWysiwygPersistenceProbe'
import {
  nativeWysiwygTableCommandMutationProbeEnabled,
} from '../qa/nativeWysiwygTableCommandMutationProbe'
import {
  nativeWysiwygWikilinkInsertProbeEnabled,
} from '../qa/nativeWysiwygWikilinkInsertProbe'
import type { MobileMetrics } from '../ui/mobileMetrics'
import type { MobileColors } from '../ui/theme/mobilePalette'
import { useMobileStyles } from '../ui/theme/useMobileTheme'
import { useMobileDeviceLayout } from '../ui/useMobileDeviceLayout'
import {
  type DevVaultWorkspaceState,
  fetchDevVaultWorkspaceState,
} from '../workspace/devVaultWorkspaceRepository'
import {
  localVaultEditorBlocks,
  localVaultEditorBullets,
  localVaultSnippet,
} from '../workspace/localVaultMarkdown'
import { MobileVaultDisplayContext, MobileVaultPickerContext } from '../workspace/MobileVaultContext'
import type { MobileNote, MobileWorkspaceSnapshot } from '../workspace/mobileWorkspaceModel'
import type { NativeWorkspaceSelection } from '../workspace/nativeWorkspacePicker'
import type { ReadOnlyWorkspaceRequest } from '../workspace/readOnlyWorkspaceRepository'
import { useMobileIncomingDeepLink } from '../workspace/useMobileIncomingDeepLink'
import { useNativeWorkspace } from '../workspace/useNativeWorkspace'
import { requestedActionSheetQaTarget } from './mobileActionSheetQaTarget'
import { initialMobileEditorStateFromMode } from './mobileEditorMode'
import {
  mobileSnapshotWithRequestedSelectedNote,
  requestedSelectedNoteId,
} from './mobileUiLabSelectedNote'
import {
  initialMobileUiNativeSearch,
} from './mobileUiLabWorkspaceResolution'
import { mobileSnapshotWithWysiwygMutationProbeContent } from './mobileUiLabWysiwygMutationSnapshot'
import { mobileRepositoryForProbes, mobileRepositoryRequestForProbes, mobileUiWorkspaceSourceRequest } from './mobileUiWorkspaceSourceRequest'
import { mobileWorkspaceKey } from './mobileWorkspaceKey'
import { PhoneWorkspace, type PhoneWorkspaceState } from './PhoneWorkspace'
import { TabletWorkspace } from './TabletWorkspace'
import { tabletTransitionProbeMode } from './tabletTransitionProbeMode'
import type { TabletTransitionProbeMode } from './tabletWorkspaceTypes'
import { useMobileWorkspaceResolution } from './useMobileWorkspaceResolution'

type DevVaultLoadState =
  | { status: 'idle' | 'loading' }
  | { message: string; status: 'error' }
  | { state: DevVaultWorkspaceState; status: 'ready' }

export function MobileUiLab() {
  const isWideEnoughForTablet = useMobileDeviceLayout() === 'tablet'
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
  const incomingDeepLink = useMobileIncomingDeepLink(
    useContext(MobileVaultPickerContext),
    workspaceSource.baseSnapshot,
  )
  const qa = mobileUiQaFlags(searchParams, { wysiwygPersistenceProbe })
  const metricSinkUrl = qa.layoutProbe ? searchParams.get('metricSink') : null
  const actionAdapterProbeRunKey = searchParams.get('qaRun') ?? 'interactive'
  const selectedSnapshot = mobileSnapshotWithRequestedSelectedNote(
    workspaceSource.baseSnapshot,
    incomingDeepLink.noteId ?? requestedSelectedNoteId(searchParams) ?? nativeWorkspace?.selectedNoteId ?? null,
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
      <View style={{ flex: 1 }}>
        {isWideEnoughForTablet
          ? <TabletWorkspace key={workspaceKey} {...sharedProps} onTableOfContentsScrollProof={qa.tableOfContentsProbe ? handleTableOfContentsScrollProof : undefined} />
          : <PhoneWorkspace key={workspaceKey} {...sharedProps} initialState={currentPhoneState(searchParams)} />}
        {incomingDeepLink.notice && <MobileDeepLinkNotice message={incomingDeepLink.notice} />}
      </View>
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

function currentPhoneState(searchParams: URLSearchParams): PhoneWorkspaceState {
  const value = searchParams.get('phoneState')

  if (value === 'editor' || value === 'properties' || value === 'sidebar') return value

  return 'list'
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
  const { request: sourceRequest, devVaultUrl } = mobileUiWorkspaceSourceRequest(searchParams, nativeWorkspace)
  const { scenarioId, source } = sourceRequest
  const devVault = useDevVaultWorkspaceState(source === 'dev', devVaultUrl)
  const request = mobileRepositoryRequestForProbes(sourceRequest, { workspacePersistenceProbe, wysiwygPersistenceProbe })
  const probeRepository = useMemo(() => mobileRepositoryForProbes({
    workspacePersistenceProbe, wysiwygPersistenceProbe,
  }), [workspacePersistenceProbe, wysiwygPersistenceProbe])
  const { baseSnapshot, repository, repositoryRequest } = useMobileWorkspaceResolution({
    devVaultState: devVault.status === 'ready' ? devVault.state : null,
    persistenceProbeEnabled: workspacePersistenceProbe || wysiwygPersistenceProbe,
    probeRepository,
    repositoryRequest: request,
    source,
  }, nativeWorkspace)

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
  const { devVaultStyles } = useMobileStyles(createThemeStyles)
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

function createThemeStyles(mobileColors: MobileColors, metrics: MobileMetrics) {
  const { type: mobileType, space: mobileSpace } = metrics
  const devVaultStyles = StyleSheet.create({
    detail: {
      maxWidth: 520,
      color: mobileColors.textMuted,
      fontSize: mobileType.body,
      lineHeight: metrics.size(22),
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
  return { mobileColors, devVaultStyles }
}
