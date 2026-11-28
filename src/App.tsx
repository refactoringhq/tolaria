import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AiWorkspaceWindowApp } from './components/AiWorkspaceWindowApp'
import { AppWorkspacePanes } from './components/AppWorkspacePanes'
import { AppSideAiWorkspace } from './components/AppSideAiWorkspace'
import { AppWorkspaceDialogs } from './components/AppWorkspaceDialogs'
import { AppWorkspaceStartup } from './components/AppWorkspaceStartup'
import { AppWorkspaceStatus } from './components/AppWorkspaceStatus'
import { CommandPalette } from './components/CommandPalette'
import { CommitDialog } from './components/CommitDialog'
import { ConflictResolverModal } from './components/ConflictResolverModal'
import { CreateTypeDialog } from './components/CreateTypeDialog'
import { CreateViewDialog } from './components/CreateViewDialog'
import { DeleteProgressNotice } from './components/DeleteProgressNotice'
import type { NoteListMultiSelectionCommands } from './components/note-list/multiSelectionCommands'
import { NoteRetargetingDialogs } from './components/note-retargeting/NoteRetargetingDialogs'
import { QuickOpenPalette } from './components/QuickOpenPalette'
import { SearchPanel } from './components/SearchPanel'
import { SettingsPanel } from './components/SettingsPanel'
import { WorkspaceSidebarUtilities } from './components/AppWorkspaceChrome'
import { createWorkspaceVaultMenu } from './components/status-bar/workspaceVaultMenu'
import { SidebarWorkspaceHeader } from './components/sidebar/SidebarChrome'
import { SETTINGS_SECTION_IDS } from './components/settingsSectionIds'
import { Toast } from './components/Toast'
import { CONTRIBUTION_ANALYTICS_EVENT, TOLARIA_DISCORD_INVITE_URL, TOLARIA_DOCS_URL } from './constants/feedback'
import { useActiveNoteLocation } from './hooks/useActiveNoteLocation'
import { useAiActivity } from './hooks/useAiActivity'
import { useAiWorkspacePublishedContext } from './hooks/useAiWorkspacePublishedContext'
import { useAiWorkspaceWindowBridgeEvents } from './hooks/useAiWorkspaceWindowBridgeEvents'
import { useAppAiWorkspaceBridge } from './hooks/useAppAiWorkspaceBridge'
import { useAppCommandAiActions } from './hooks/useAppCommandAiActions'
import { useAppCommands } from './hooks/useAppCommands'
import { useAppCollectionNavigation } from './hooks/useAppCollectionNavigation'
import { useAppShellPlatform } from './hooks/useAppShellPlatform'
import {
  useAppEditorCommands,
  useAppListPropertyCommands,
  useAppNotePropertyCommands,
  useAppNoteWindowCommands,
} from './hooks/useAppNoteCommands'
import { useAppNavigation } from './hooks/useAppNavigation'
import { AppPreferencesProvider, useAppPreferences } from './hooks/useAppPreferences'
import { useAppVaultAiGuidance, useAppWorkspaceRuntime } from './hooks/useAppWorkspaceRuntime'
import { useAppVaultMaintenance } from './hooks/useAppVaultMaintenance'
import { useAppVaultStartup } from './hooks/useAppVaultStartup'
import { useWorkspaceAiOnboarding } from './hooks/useWorkspaceAiOnboarding'
import { useAppSidebarSync } from './hooks/useAppSidebarSync'
import { useAppSave } from './hooks/useAppSave'
import { useAppCheckpointing } from './hooks/useAppCheckpointing'
import { useAppActiveEditor, useAppWorkspaceLayout, useAppWorkspaceStartupState } from './hooks/useAppWorkspaceView'
import { useAppViewActions } from './hooks/useAppViewActions'
import { useAppWindowControls } from './hooks/useAppWindowControls'
import { useAutoSync } from './hooks/useAutoSync'
import { useBulkActions } from './hooks/useBulkActions'
import { useCommitFlow } from './hooks/useCommitFlow'
import { useConflictFlow } from './hooks/useConflictFlow'
import { useConflictResolver } from './hooks/useConflictResolver'
import { useDeepLinks } from './hooks/useDeepLinks'
import { useDeleteActions } from './hooks/useDeleteActions'
import { useDialogs } from './hooks/useDialogs'
import { useEntryActions } from './hooks/useEntryActions'
import { useFileActions } from './hooks/useFileActions'
import { useFolderActions } from './hooks/useFolderActions'
import { useGitFileWorkflows } from './hooks/useGitFileWorkflows'
import { useGitHistory } from './hooks/useGitHistory'
import { useInboxOrganizeAdvance } from './hooks/useInboxOrganizeAdvance'
import { useMcpSetupDialogController } from './hooks/useMcpSetupDialogController'
import {
  useNeighborhoodEscape,
  useNeighborhoodHistoryBack,
  useSelectionSanitizer,
} from './hooks/useNeighborhoodSelection'
import { useNetworkStatus } from './hooks/useNetworkStatus'
import { useNoteActions } from './hooks/useNoteActions'
import { useNoteGitUrls } from './hooks/useNoteGitUrls'
import { useNoteRetargetingUi } from './hooks/useNoteRetargetingUi'
import { syncVaultAssetScope, useNoteWindowLifecycle } from './hooks/useNoteWindowLifecycle'
import { useSavedViewOrdering } from './hooks/useSavedViewOrdering'
import { useSettings } from './hooks/useSettings'
import { restartApp, useUpdater } from './hooks/useUpdater'
import { useVaultBridge } from './hooks/useVaultBridge'
import { useVaultOpenedTelemetry } from './hooks/useVaultOpenedTelemetry'
import { useVaultRefreshHandlers } from './hooks/useVaultRefreshHandlers'
import { useVaultRenameDetection } from './hooks/useVaultRenameDetection'
import { useRecentVaultWrites, useVaultWatcher } from './hooks/useVaultWatcher'
import { useVisibleWorkspaceEntries } from './hooks/useWorkspaceGraphState'
import { areAiFeaturesEnabled } from './lib/aiFeatures'
import { type AiTarget, resolveAiTargetReadiness } from './lib/aiTargets'
import { areAutomaticUpdateChecksEnabled } from './lib/automaticUpdateChecks'
import {
  translate,
} from './lib/i18n'
import { normalizeReleaseChannel } from './lib/releaseChannel'
import { trackEvent } from './lib/telemetry'
import { isTauri, mockInvoke } from './mock-tauri'
import type { SidebarSelection, VaultConfig, VaultEntry, WorkspaceIdentity } from './types'
import {
  activeVaultModifiedFiles,
  aiWorkspaceWindowContextForPath,
  canCustomizeColumnsForSelection,
  isActiveElementInsideEditorSurface,
  mergeModifiedFiles,
  runNativeTextHistoryCommand,
} from './utils/appOrchestration'
import { noteWorkspaceContext, workspaceGitAvailability } from './utils/appWorkspaceContext'
import { triggerCommitEntryAction } from './utils/commitEntryAction'
import { generateCommitMessage } from './utils/commitMessage'
import { persistEditorStateBeforeMutation } from './utils/editorMutationFlush'
import { hasNoteIconValue } from './utils/noteIcon'
import {
  INBOX_SELECTION,
  isExplicitOrganizationEnabled,
  sanitizeSelectionForOrganization,
} from './utils/organizationWorkflow'
import type { RichEditorBlockTypeDefinition } from './utils/richEditorBlockTypes'
import { shouldReplaceSyncedTabEntry } from './utils/tabEntrySync'
import { resolveTypeDeleteRequest, typeDeleteBlockedMessageKey } from './utils/typeDeletion'
import { openExternalUrl } from './utils/url'
import { createVaultFolder } from './utils/vaultFolderCreation'
import { viewMatchesSelection } from './utils/viewIdentity'
import { getNoteWindowParams, isAiWorkspaceWindow, isNoteWindow, type NoteWindowParams } from './utils/windowMode'
import {
  vaultPathForEntry,
} from './utils/workspaces'
import './App.css'

// Type declarations for mock content storage and test overrides
declare global {
  interface Window {
    __mockContent?: Record<string, string>
    __mockHandlers?: Record<string, (args?: unknown) => unknown>
  }
}

/** Wraps useEditorSave to also keep outgoingLinks in sync on save and on content change. */
function App() {
  const noteWindowParams = useMemo(() => isNoteWindow() ? getNoteWindowParams() : null, [])
  const aiWorkspaceWindow = useMemo(() => isAiWorkspaceWindow(), [])

  if (aiWorkspaceWindow) return <AiWorkspaceWindowApp />

  return <MainApp noteWindowParams={noteWindowParams} />
}

function useAppOrganizationSelection(
  selection: SidebarSelection,
  { inbox, updateConfig }: Pick<ReturnType<typeof useAppWorkspaceRuntime>['git'], 'updateConfig'> & Pick<VaultConfig, 'inbox'>,
) {
  const { explicitOrganization, noteListProperties = null } = inbox ?? {}
  const explicitOrganizationEnabled = isExplicitOrganizationEnabled(explicitOrganization)
  const effectiveSelection = sanitizeSelectionForOrganization(selection, explicitOrganization)
  const isChangesSelection = effectiveSelection.kind === 'filter' && effectiveSelection.filter === 'changes'
  const handleSaveExplicitOrganization = useCallback((enabled: boolean) => {
    updateConfig('inbox', { noteListProperties, explicitOrganization: enabled })
  }, [updateConfig, noteListProperties])
  return { explicitOrganizationEnabled, effectiveSelection, isChangesSelection, handleSaveExplicitOrganization }
}

function MainApp({ noteWindowParams }: { noteWindowParams: NoteWindowParams | null }) {
  const secondaryWindow = Boolean(noteWindowParams)
  const { platformCapabilities, vaultBackend, showDesktopSidebarChrome } = useAppShellPlatform()
  const [workspacePickerOpen, setWorkspacePickerOpen] = useState(false)
  const { selections, noteList, collectionLayout } = useAppCollectionNavigation()
  const { selection, selectionRef, setSelection, neighborhoodHistoryRef, handleSetSelection, handleEnterNeighborhood } = selections
  const { noteListFilter, setNoteListFilter, inboxPeriod } = noteList
  const { layout, showPrimaryDesktopChrome } = useAppWorkspaceLayout(secondaryWindow, showDesktopSidebarChrome)
  const { setInspectorCollapsed } = layout
  const visibleNotesRef = useRef<VaultEntry[]>([])
  const multiSelectionCommandRef = useRef<NoteListMultiSelectionCommands | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [gitHistoryRefreshKey, setGitHistoryRefreshKey] = useState(0)
  const dialogs = useDialogs()
  const { closeAIChat, openAIChat, showAIChat } = dialogs
  const [showFeedback, setShowFeedback] = useState(false)
  const openFeedback = useCallback(() => setShowFeedback(true), [])
  const closeFeedback = useCallback(() => setShowFeedback(false), [])
  const openDocs = useCallback(() => {
    void openExternalUrl(TOLARIA_DOCS_URL)
  }, [])
  const openDiscord = useCallback((surface: 'sidebar' | 'native_menu') => {
    trackEvent(CONTRIBUTION_ANALYTICS_EVENT, { action: 'discord', surface })
    void openExternalUrl(TOLARIA_DISCORD_INVITE_URL)
  }, [])
  const networkStatus = useNetworkStatus()
  const { settings, loaded: settingsLoaded, saveSettings } = useSettings()
  const aiFeaturesEnabled = areAiFeaturesEnabled(settings)

  // The switch callback is called on user interaction, after note actions are ready.
  const { vaultSwitcher, onboarding, cloneGettingStartedVault, resolvedPath } = useAppVaultStartup({
    noteWindowParams,
    onSwitch: () => {
      if (secondaryWindow) return
      handleSetSelection(INBOX_SELECTION)
      notes.closeAllTabs()
    },
    onToast: setToastMessage,
  })
  const { selectedVaultPath } = vaultSwitcher
  const { aiAgentsStatus, aiAgentsOnboarding, modelSelectorAvailable } = useWorkspaceAiOnboarding({
    enabled: aiFeaturesEnabled,
    vaultReady: onboarding.state.status === 'ready',
    secondaryWindow,
  })
  const aiWorkspaceWindowContext = useMemo(() => aiWorkspaceWindowContextForPath(resolvedPath), [resolvedPath])
  const [settingsInitialSectionId, setSettingsInitialSectionId] = useState<string | null>(null)
  const {
    effectiveShowAIChat,
    handleOpenAiSettings,
    handleOpenDockedAiWorkspace,
  } = useAppAiWorkspaceBridge({
    aiFeaturesEnabled,
    aiWorkspaceWindow: false,
    closeAIChat,
    modelSelectorAvailable,
    openAIChat,
    openSettings: dialogs.openSettings,
    setSettingsInitialSectionId,
    showAIChat,
  })
  const handleToggleAiWorkspace = useCallback(() => {
    if (effectiveShowAIChat) {
      closeAIChat()
      return
    }
    handleOpenDockedAiWorkspace()
  }, [closeAIChat, effectiveShowAIChat, handleOpenDockedAiWorkspace])
  const [lastAiWorkspaceConversationId, setLastAiWorkspaceConversationId] = useState<string | null>(null)
  const handleActiveAiWorkspaceConversationChange = useCallback((id: string) => {
    setLastAiWorkspaceConversationId(id)
  }, [])
  const [lastAiWorkspaceTarget, setLastAiWorkspaceTarget] = useState<AiTarget | null>(null)
  const handleActiveAiWorkspaceTargetChange = useCallback((target: AiTarget) => {
    setLastAiWorkspaceTarget((current) => (current?.id === target.id ? current : target))
  }, [])
  const { graph, git, vault, gitRepositories, activeGitRepositoryPaths, gitSurfaces } = useAppWorkspaceRuntime({
    resolvedPath,
    vaultSwitcher,
    settings,
    secondaryWindow,
    gitAvailable: platformCapabilities.git,
    onToast: setToastMessage,
  })
  const { graphDefaultWorkspacePath, inspectorWorkspaces, multiWorkspaceEnabled, visibleWorkspacePathList, writableVaultPaths } = graph
  const { setup, vaultConfig, updateConfig, gitFeaturesEnabled, automaticGitEnabled } = git
  const { dismissGitSetupDialog, gitRepoState, handleInitGitRepo, neverForVaultGitSetupDialog, openGitSetupDialog, shouldShowGitSetupDialog } = setup
  const { noteCreationScope, noteLocationLoading } = noteWorkspaceContext({ graph, vault }, vaultSwitcher, resolvedPath)
  const { canAutoSync, automaticVaultPaths, isGitVault } = workspaceGitAvailability(git, activeGitRepositoryPaths)
  const vaultWorkspaceOrder = useMemo(
    () => vaultSwitcher.allVaults.map((vault) => vault.path),
    [vaultSwitcher.allVaults],
  )
  const watchedVaultPaths = useMemo(() => {
    if (visibleWorkspacePathList && visibleWorkspacePathList.length > 0) return visibleWorkspacePathList
    return resolvedPath.trim() ? [resolvedPath] : []
  }, [resolvedPath, visibleWorkspacePathList])
  const visibleEntries = useVisibleWorkspaceEntries({
    entries: vault.entries,
    multiWorkspaceEnabled,
    visibleWorkspacePathList,
  })
  const runtimeMissingVaultPath = vault.unavailableVaultPath
  const {
    markInternalWrite: markRecentVaultWrite,
    filterExternalPaths: filterExternalVaultPaths,
  } = useRecentVaultWrites({
    vaultPath: resolvedPath,
    vaultPaths: watchedVaultPaths,
  })
  const {
    status: vaultAiGuidanceStatus,
    refresh: refreshVaultAiGuidance,
  } = useAppVaultAiGuidance(aiFeaturesEnabled, resolvedPath, vault.entries)
  const { explicitOrganizationEnabled, effectiveSelection, isChangesSelection, handleSaveExplicitOrganization } =
    useAppOrganizationSelection(selection, { inbox: vaultConfig.inbox, updateConfig })

  useSelectionSanitizer({
    effectiveSelection,
    neighborhoodHistoryRef,
    selection,
    selectionRef,
    setNoteListFilter,
    setSelection,
  })

  const handleNeighborhoodHistoryBack = useNeighborhoodHistoryBack({
    neighborhoodHistoryRef,
    setSelection: handleSetSelection,
  })

  const {
    aiAgentPreferences,
    allNotesFileVisibility,
    appLocale,
    dateDisplayFormat,
    documentThemeMode,
    handleSetThemeMode,
    handleSetUiLanguage,
    handleToggleThemeMode,
    selectedUiLanguage,
    systemLocale,
  } = useAppPreferences({
    aiAgentsStatus,
    onToast: setToastMessage,
    saveSettings,
    settings,
    settingsLoaded,
  })
  const fileActions = useFileActions({
    locale: appLocale,
    selection: effectiveSelection,
    setToastMessage,
    vaultPath: resolvedPath,
  })
  const quickPromptTarget = lastAiWorkspaceTarget ?? aiAgentPreferences.defaultAiTarget
  const quickPromptTargetReady = resolveAiTargetReadiness(quickPromptTarget, aiAgentsStatus, {
    tauri: isTauri(),
  }).canQueuePrompt

  useVaultOpenedTelemetry({
    entryCount: vault.entries.length,
    gitRepoState,
    resolvedPath,
  })
  const mcpSetupDialog = useMcpSetupDialogController(resolvedPath, setToastMessage, appLocale)
  const loadDefaultVaultModifiedFiles = vault.loadModifiedFiles
  const loadAllGitModifiedFiles = gitSurfaces.loadAllModifiedFiles
  const loadModifiedFilesForRepository = gitSurfaces.loadModifiedFilesForRepository
  const refreshAllGitRemoteStatuses = gitSurfaces.refreshAllRemoteStatuses
  const refreshRemoteStatusForRepository = gitSurfaces.refreshRemoteStatusForRepository
  const refreshGitRemoteStatus = useCallback(
    () => refreshRemoteStatusForRepository(resolvedPath),
    [refreshRemoteStatusForRepository, resolvedPath],
  )
  const refreshGitModifiedFiles = useCallback(async () => {
    if (!automaticGitEnabled) return
    await Promise.all([
      loadDefaultVaultModifiedFiles(),
      loadAllGitModifiedFiles({ includeStats: isChangesSelection }),
    ])
  }, [automaticGitEnabled, isChangesSelection, loadAllGitModifiedFiles, loadDefaultVaultModifiedFiles])
  const loadVaultModifiedFiles = refreshGitModifiedFiles

  useEffect(() => {
    if (!automaticGitEnabled) return
    if (gitRepoState !== 'ready') return
    void loadVaultModifiedFiles()
    void refreshGitRemoteStatus()
    void refreshAllGitRemoteStatuses()
  }, [automaticGitEnabled, gitRepoState, loadVaultModifiedFiles, refreshAllGitRemoteStatuses, refreshGitRemoteStatus])

  const handleOpenSettings = useCallback(() => {
    setSettingsInitialSectionId(null)
    dialogs.openSettings()
  }, [dialogs])

  const handleOpenVaultSettings = useCallback(() => {
    setSettingsInitialSectionId(SETTINGS_SECTION_IDS.workspaces)
    dialogs.openSettings()
  }, [dialogs])

  const {
    detectedRenames,
    handleUpdateWikilinks,
    handleDismissRenames,
  } = useVaultRenameDetection({
    reloadVault: vault.reloadVault,
    setToastMessage,
    vaultPath: resolvedPath,
  })

  const conflictResolver = useConflictResolver({
    vaultPath: resolvedPath,
    onResolved: () => {
      dialogs.closeConflictResolver()
      autoSync.resumePull()
      vault.reloadVault()
      autoSync.triggerSync()
    },
    onToast: (msg) => setToastMessage(msg),
    onOpenFile: (relativePath) => conflictFlow.openConflictFileRef.current(relativePath),
  })
  const flushPendingEditorContentRef = useRef<((path: string) => void) | null>(null)
  const flushPendingRawContentRef = useRef<((path: string) => void) | null>(null)
  const appSaveFlushBeforeActionRef = useRef<((path: string) => Promise<unknown>) | null>(null)
  const appSavePendingForPathRef = useRef<((path: string) => Promise<unknown>) | null>(null)
  const flushEditorStateBeforeAction = useCallback(async (path: string) => {
    flushPendingEditorContentRef.current?.(path)
    flushPendingRawContentRef.current?.(path)
    await appSaveFlushBeforeActionRef.current?.(path)
  }, [])
  const flushEditorStateBeforeMutation = useCallback(
    (path: string) => persistEditorStateBeforeMutation({
      path,
      flushPendingEditorContent: flushPendingEditorContentRef.current,
      flushPendingRawContent: flushPendingRawContentRef.current,
      savePendingForPath: appSavePendingForPathRef.current,
    }),
    [],
  )
  const handleCreatedVaultEntryPersisting = useCallback((path: string) => {
    markRecentVaultWrite(path)
    vault.addPendingSave(path)
  }, [markRecentVaultWrite, vault])
  const handleCreatedVaultEntryPersisted = useCallback((path: string) => {
    markRecentVaultWrite(path)
    void refreshGitModifiedFiles()
  }, [markRecentVaultWrite, refreshGitModifiedFiles])
  const handleMissingActiveVault = useCallback(() => {
    if (!noteWindowParams && resolvedPath) vault.markVaultUnavailable(resolvedPath)
  }, [noteWindowParams, resolvedPath, vault])

  const notes = useNoteActions({
    addEntry: vault.addEntry,
    removeEntry: vault.removeEntry,
    entries: visibleEntries,
    flushBeforeNoteSwitch: flushEditorStateBeforeAction,
    flushBeforeNoteMutation: flushEditorStateBeforeMutation,
    reloadVault: vault.reloadVault,
    setToastMessage,
    updateEntry: vault.updateEntry,
    vaultPath: resolvedPath,
    ...noteCreationScope,
    addPendingSave: handleCreatedVaultEntryPersisting,
    removePendingSave: vault.removePendingSave,
    trackUnsaved: vault.trackUnsaved,
    clearUnsaved: vault.clearUnsaved,
    unsavedPaths: vault.unsavedPaths,
    markContentPending: (path, content) => appSave.contentChangeRef.current(path, content),
    onNewNotePersisted: handleCreatedVaultEntryPersisted,
    onMissingActiveVault: handleMissingActiveVault,
    onTypeStateChanged: async () => { await vault.reloadVault() },
    replaceEntry: vault.replaceEntry,
    onInternalVaultWrite: markRecentVaultWrite,
    onFrontmatterPersisted: refreshGitModifiedFiles,
    onPathRenamed: (oldPath, newPath) => appSave.trackRenamedPath(oldPath, newPath),
    onOpenExternalFile: fileActions.openExternalFile,
  })
  const {
    handleSelectNote,
    handleReplaceActiveTab,
    closeAllTabs,
    openTabWithContent,
    setTabs: setNoteTabs,
  } = notes
  const noteActiveTabPath = notes.activeTabPath
  const noteActiveTabPathRef = notes.activeTabPathRef
  useActiveNoteLocation({
    activeNotePath: noteActiveTabPath,
    enabled: !noteWindowParams,
    entries: visibleEntries,
    isVaultLoading: noteLocationLoading,
    openNote: handleSelectNote,
    selection,
    setSelection: handleSetSelection,
    vaultPath: resolvedPath,
    vaults: vaultSwitcher.allVaults,
    views: vault.views,
  })
  useNoteWindowLifecycle({
    activeTabPath: notes.activeTabPath,
    handleSelectNote,
    noteWindowParams,
    openTabWithContent,
    setToastMessage,
    tabs: notes.tabs,
  })
  const { handleFocusedVaultUpdate, handlePulledVaultUpdate, refocusActiveEditor } = useVaultRefreshHandlers({
    closeAllTabs,
    handleReplaceActiveTab,
    noteActiveTabPath,
    noteActiveTabPathRef,
    noteWindowParams,
    refreshGitModifiedFiles,
    resolvedPath,
    tabs: notes.tabs,
    vault,
    visibleEntries,
  })
  const refreshGitHistorySurfaces = useCallback(() => {
    setGitHistoryRefreshKey((key) => key + 1)
  }, [])
  useEffect(() => {
    if (watchedVaultPaths.length === 0) return
    let cancelled = false
    for (const vaultPath of watchedVaultPaths) {
      void syncVaultAssetScope(vaultPath).catch((err) => {
        if (!cancelled) console.warn('[vault] Failed to sync asset scope:', err)
      })
    }
    return () => {
      cancelled = true
    }
  }, [watchedVaultPaths])
  useVaultWatcher({
    vaultPath: resolvedPath,
    vaultPaths: watchedVaultPaths,
    onVaultChanged: handleFocusedVaultUpdate,
    filterChangedPaths: filterExternalVaultPaths,
  })
  const autoSync = useAutoSync({
    enabled: canAutoSync,
    vaultPath: gitSurfaces.syncRepositoryPath,
    vaultPaths: activeGitRepositoryPaths,
    intervalMinutes: settings.auto_pull_interval_minutes,
    onVaultUpdated: handlePulledVaultUpdate,
    onSyncUpdated: refreshGitHistorySurfaces,
    onConflict: (files) => {
      const names = files.map((f) => f.split('/').pop()).join(', ')
      setToastMessage(`Conflict in ${names} — click to resolve`)
    },
    onToast: (msg) => setToastMessage(msg),
  })
  // Keep note entry in sync with vault entries so banners (trash/archive)
  // and read-only state react immediately without reopening the note.
  useEffect(() => {
    setNoteTabs(prev => {
      let changed = false
      const next = prev.map(tab => {
        const fresh = visibleEntries.find(e => e.path === tab.entry.path)
        if (fresh && shouldReplaceSyncedTabEntry(tab.entry, fresh)) {
          changed = true
          return { ...tab, entry: fresh }
        }
        return tab
      })
      return changed ? next : prev
    })
  }, [visibleEntries, setNoteTabs])

  const { handleGoBack, handleGoForward, canGoBack, canGoForward, entriesByPath } = useAppNavigation({
    entries: visibleEntries,
    activeTabPath: notes.activeTabPath,
    onSelectNote: notes.handleSelectNote,
  })

  const handleOpenFavorite = useCallback(async (entry: VaultEntry) => {
    await handleReplaceActiveTab(entry)
    handleEnterNeighborhood(entry)
  }, [handleEnterNeighborhood, handleReplaceActiveTab])

  const vaultBridge = useVaultBridge({
    entriesByPath,
    resolvedPath,
    reloadVault: vault.reloadVault,
    reloadFolders: vault.reloadFolders,
    reloadViews: vault.reloadViews,
    closeAllTabs,
    replaceActiveTab: handleReplaceActiveTab,
    refocusActiveEditor,
    hasUnsavedChanges: (path) => vault.unsavedPaths.has(path),
    shouldRefocusActiveEditor: isActiveElementInsideEditorSurface,
    onSelectNote: notes.handleSelectNote,
    activeTabPath: notes.activeTabPath,
    getActiveTabPath: () => notes.activeTabPathRef.current,
  })
  const handleAiWorkspaceWindowOpenNote = notes.handleNavigateWikilink
  const {
    handleAgentFileCreated: handleAiWorkspaceWindowFileCreated,
    handleAgentFileModified: handleAiWorkspaceWindowFileModified,
    handleAgentVaultChanged: handleAiWorkspaceWindowVaultChanged,
  } = vaultBridge
  useAiWorkspaceWindowBridgeEvents({
    onFileCreated: handleAiWorkspaceWindowFileCreated,
    onFileModified: handleAiWorkspaceWindowFileModified,
    onOpenNote: handleAiWorkspaceWindowOpenNote,
    onVaultChanged: handleAiWorkspaceWindowVaultChanged,
  })

  const conflictFlow = useConflictFlow({
    resolvedPath: autoSync.conflictVaultPath ?? graphDefaultWorkspacePath,
    entries: visibleEntries,
    conflictFiles: autoSync.conflictFiles,
    pausePull: autoSync.pausePull, resumePull: autoSync.resumePull,
    triggerSync: autoSync.triggerSync, reloadVault: vault.reloadVault,
    initConflictFiles: conflictResolver.initFiles,
    openConflictResolver: dialogs.openConflictResolver,
    closeConflictResolver: dialogs.closeConflictResolver,
    onSelectNote: notes.handleSelectNote,
    activeTabPath: notes.activeTabPath,
    setToastMessage,
  })

  const appSave = useAppSave({
    updateEntry: vault.updateEntry, setTabs: notes.setTabs, handleSwitchTab: notes.handleSwitchTab, setToastMessage,
    loadModifiedFiles: refreshGitModifiedFiles, reloadViews: async () => { await vault.reloadViews() },
    trackUnsaved: vault.trackUnsaved, clearUnsaved: vault.clearUnsaved, unsavedPaths: vault.unsavedPaths,
    tabs: notes.tabs, activeTabPath: notes.activeTabPath,
    handleRenameNote: notes.handleRenameNote, handleRenameFilename: notes.handleRenameFilename,
    replaceEntry: vault.replaceEntry, resolvedPath,
    writableVaultPaths,
    initialH1AutoRenameEnabled: settings.initial_h1_auto_rename_enabled !== false,
    onInternalVaultWrite: markRecentVaultWrite,
    locale: appLocale,
  })
  useEffect(() => {
    appSaveFlushBeforeActionRef.current = appSave.flushBeforeAction
    appSavePendingForPathRef.current = appSave.savePendingForPath
  }, [appSave.flushBeforeAction, appSave.savePendingForPath])

  const handleChangeWorkspace = useCallback(async (entry: VaultEntry, workspace: WorkspaceIdentity) => {
    const sourceVaultPath = vaultPathForEntry(entry, resolvedPath)
    if (sourceVaultPath === workspace.path) return

    try {
      await flushEditorStateBeforeAction(entry.path)
      const result = await notes.handleMoveNoteToWorkspace(
        entry.path,
        workspace,
        sourceVaultPath,
        (oldPath, newEntry) => {
          appSave.trackRenamedPath(oldPath, newEntry.path)
          vault.replaceEntry(oldPath, newEntry)
          if (effectiveSelection.kind === 'entity' && effectiveSelection.entry.path === oldPath) {
            handleSetSelection({
              kind: 'entity',
              entry: {
                ...effectiveSelection.entry,
                ...newEntry,
              },
            })
          }
        },
      )
      if (!result) return

      markRecentVaultWrite(entry.path)
      markRecentVaultWrite(result.new_path)
      await refreshGitModifiedFiles()
    } catch (err) {
      console.error('Failed to change note workspace:', err)
      setToastMessage(`Failed to move note: ${String(err)}`)
    }
  }, [
    appSave,
    effectiveSelection,
    flushEditorStateBeforeAction,
    handleSetSelection,
    markRecentVaultWrite,
    notes,
    refreshGitModifiedFiles,
    resolvedPath,
    vault
  ])

  const aiActivity = useAiActivity({
    onOpenNote: vaultBridge.openNoteByPath,
    onOpenTab: vaultBridge.openNoteByPath,
    onSetFilter: (filterType) => {
      handleSetSelection({ kind: 'sectionGroup', type: filterType })
    },
    onVaultChanged: (path) => { void handlePulledVaultUpdate(path ? [path] : [], resolvedPath) },
  })

  const { handleInitializeProperties, handleSetNoteIconCommand, handleRemoveNoteIconCommand } =
    useAppNotePropertyCommands(notes, setInspectorCollapsed)

  const { handleCustomizeNoteListColumns, handleUpdateAllNotesNoteListProperties, handleUpdateInboxNoteListProperties } =
    useAppListPropertyCommands({ effectiveSelection, updateConfig, vaultConfig })

  const handleCreateFolder = useCallback(async (
    name: string,
    parent?: { path: string; rootPath?: string },
  ) => {
    try {
      await createVaultFolder({ name, parent, defaultVaultPath: resolvedPath })
      await vault.reloadFolders()
      setToastMessage(`Created folder "${name}"`)
      return true
    } catch (e) {
      setToastMessage(`Failed to create folder: ${e}`)
      return false
    }
  }, [resolvedPath, vault])

  const folderActions = useFolderActions({
    vaultPath: resolvedPath,
    selection: effectiveSelection,
    setSelection: handleSetSelection,
    setTabs: notes.setTabs,
    activeTabPathRef: notes.activeTabPathRef,
    handleSwitchTab: notes.handleSwitchTab,
    closeAllTabs: notes.closeAllTabs,
    reloadVault: vault.reloadVault,
    reloadFolders: vault.reloadFolders,
    setToastMessage,
  })
  const { handleOpenInNewWindow, handleOpenEntryInNewWindow } = useAppNoteWindowCommands(notes, resolvedPath)

  const allGitModifiedFiles = useMemo(
    () => mergeModifiedFiles(
      gitSurfaces.allModifiedFiles,
      activeVaultModifiedFiles(vault.modifiedFiles, resolvedPath),
    ),
    [gitSurfaces.allModifiedFiles, resolvedPath, vault.modifiedFiles],
  )
  const selectedChangesModifiedFiles = gitSurfaces.changesModifiedFiles
  const commitModifiedFiles = gitSurfaces.commitModifiedFiles
  const changesRepositoryPath = gitSurfaces.changesRepositoryPath
  const gitModifiedCount = gitFeaturesEnabled ? allGitModifiedFiles.length : 0

  const {
    activeDeletedFile,
    activeNoteModified,
    handleDiscardFile,
    handleOpenDeletedNote,
    handlePendingDiffHandled,
    handlePulseOpenNote,
    handleReplaceActiveTabWithQueuedDiff,
    loadDiffAtCommitForPath,
    loadDiffForPath,
    loadGitHistoryForPath,
    pendingDiffRequest,
  } = useGitFileWorkflows({
    activeTabPath: notes.activeTabPath,
    allGitModifiedFiles,
    changesRepositoryPath,
    effectiveSelection,
    entriesByPath,
    historyRepositoryPath: gitSurfaces.historyRepositoryPath,
    loadModifiedFilesForRepository,
    onCloseAllTabs: notes.closeAllTabs,
    onOpenTabWithContent: notes.openTabWithContent,
    onReplaceActiveTab: notes.handleReplaceActiveTab,
    onSelectNote: notes.handleSelectNote,
    reloadVault: vault.reloadVault,
    resolvedPath,
    selectedChangesModifiedFiles,
    setToastMessage,
    tabs: notes.tabs,
    vaultEntries: vault.entries,
    visibleEntries,
  })

  const commitFlow = useCommitFlow({
    aiFeaturesEnabled,
    autoGitAiCommitMessagesEnabled: settings.autogit_use_ai_commit_messages === true,
    commitMessageTarget: quickPromptTarget,
    commitMessageTargetReady: quickPromptTargetReady,
    savePending: appSave.savePending,
    loadModifiedFiles: refreshGitModifiedFiles,
    loadModifiedFilesForVaultPath: loadModifiedFilesForRepository,
    resolveRemoteStatusForVaultPath: refreshRemoteStatusForRepository,
    setToastMessage,
    onPushRejected: autoSync.handlePushRejected,
    automaticVaultPaths,
    locale: appLocale,
    manualVaultPath: gitSurfaces.commitRepositoryPath,
    vaultPath: resolvedPath,
  })
  const suggestedCommitMessage = useMemo(() => generateCommitMessage(commitModifiedFiles), [commitModifiedFiles])
  const {
    activitySignature: autoGitActivitySignature,
    recordActivity: recordAutoGitActivity,
  } = useAppCheckpointing({
    activeRemoteStatus: autoSync.remoteStatus,
    activeVaultPath: resolvedPath,
    modifiedFiles: allGitModifiedFiles,
    repositoryPaths: activeGitRepositoryPaths,
    remoteStatusForRepository: gitSurfaces.remoteStatusForRepository,
  }, {
    automaticGitEnabled,
    settings,
    isGitVault,
    hasUnsavedChanges: vault.unsavedPaths.size > 0,
    onCheckpoint: () => commitFlow.runAutomaticCheckpoint(),
  })
  const openCommitDialog = commitFlow.openCommitDialog
  const runAutomaticCheckpoint = commitFlow.runAutomaticCheckpoint
  const handleAppContentChange = appSave.handleContentChange
  const handleAppSave = appSave.handleSave
  const loadModifiedFiles = refreshGitModifiedFiles
  const triggerSync = autoSync.triggerSync
  const pullAndPush = autoSync.pullAndPush

  useEffect(() => {
    if (!gitFeaturesEnabled) return
    if (!isChangesSelection) return
    void loadModifiedFilesForRepository(changesRepositoryPath, { includeStats: true })
  }, [changesRepositoryPath, gitFeaturesEnabled, isChangesSelection, loadModifiedFilesForRepository])

  useEffect(() => {
    if (autoGitActivitySignature.length === 0) return
    recordAutoGitActivity()
  }, [autoGitActivitySignature, recordAutoGitActivity])

  const handleCommitPush = useCallback(() => {
    if (!gitFeaturesEnabled) return
    triggerCommitEntryAction({
      autoGitEnabled: settings.autogit_enabled === true,
      openCommitDialog,
      runAutomaticCheckpoint,
    })
  }, [gitFeaturesEnabled, openCommitDialog, runAutomaticCheckpoint, settings.autogit_enabled])
  const handlePullRepository = useCallback((targetVaultPath: string) => {
    if (!gitFeaturesEnabled) return
    triggerSync(targetVaultPath)
  }, [gitFeaturesEnabled, triggerSync])
  const handlePullSelectedRepository = useCallback(() => {
    if (!gitFeaturesEnabled) return
    triggerSync()
  }, [gitFeaturesEnabled, triggerSync])
  const handlePullAndPushSelectedRepository = useCallback(() => {
    pullAndPush()
  }, [pullAndPush])

  const handleTrackedContentChange = useCallback((path: string, content: string) => {
    recordAutoGitActivity()
    handleAppContentChange(path, content)
  }, [handleAppContentChange, recordAutoGitActivity])

  const handleTrackedSave = useCallback(async (...args: Parameters<typeof handleAppSave>) => {
    if (notes.activeTabPath) {
      flushPendingEditorContentRef.current?.(notes.activeTabPath)
      flushPendingRawContentRef.current?.(notes.activeTabPath)
    }
    const result = await handleAppSave(...args)
    const activeTab = notes.activeTabPath
      ? notes.tabs.find((tab) => tab.entry.path === notes.activeTabPath)
      : null
    if (activeTab) {
      await loadModifiedFilesForRepository(vaultPathForEntry(activeTab.entry, resolvedPath), {
        includeStats: isChangesSelection,
      })
    }
    recordAutoGitActivity()
    return result
  }, [
    handleAppSave,
    isChangesSelection,
    loadModifiedFilesForRepository,
    notes.activeTabPath,
    notes.tabs,
    recordAutoGitActivity,
    resolvedPath,
  ])

  const seedAutoGitSavedChange = useCallback(async () => {
    if (isTauri()) {
      throw new Error('seedAutoGitSavedChange is only available in browser smoke tests')
    }

    const activePath = notes.activeTabPath
    const activeTab = activePath
      ? notes.tabs.find((tab) => tab.entry.path === activePath)
      : null

    if (!activePath || !activeTab) {
      throw new Error('No active note is available for the AutoGit test bridge')
    }

    const saveNoteContent = window.__mockHandlers?.save_note_content
    const activeVaultPath = vaultPathForEntry(activeTab.entry, resolvedPath)
    if (typeof saveNoteContent === 'function') {
      await Promise.resolve(saveNoteContent({ path: activePath, content: activeTab.content, vaultPath: activeVaultPath }))
    } else {
      await mockInvoke('save_note_content', { path: activePath, content: activeTab.content, vaultPath: activeVaultPath })
    }

    await loadModifiedFiles()
    recordAutoGitActivity()
  }, [loadModifiedFiles, notes.activeTabPath, notes.tabs, recordAutoGitActivity, resolvedPath])

  useEffect(() => {
    window.__laputaTest = {
      ...window.__laputaTest,
      activeTabPath: notes.activeTabPath,
      seedAutoGitSavedChange,
    }

    return () => {
      if (window.__laputaTest?.seedAutoGitSavedChange === seedAutoGitSavedChange) {
        delete window.__laputaTest.seedAutoGitSavedChange
      }
    }
  }, [notes.activeTabPath, seedAutoGitSavedChange])

  const entryActions = useEntryActions({
    entries: visibleEntries, updateEntry: vault.updateEntry,
    handleUpdateFrontmatter: notes.handleUpdateFrontmatter,
    handleDeleteProperty: notes.handleDeleteProperty, setToastMessage,
    createTypeEntry: notes.createTypeEntrySilent,
    onBeforeAction: flushEditorStateBeforeAction,
    actionHistory: notes.actionHistory,
  })

  const resolveVaultPathForNotePath = useCallback((path: string) => {
    const entry = vault.entries.find((candidate) => candidate.path === path)
    return entry ? vaultPathForEntry(entry, resolvedPath) : resolvedPath
  }, [resolvedPath, vault.entries])

  const deleteActions = useDeleteActions({
    onDeselectNote: (path: string) => { if (notes.activeTabPath === path) notes.closeAllTabs() },
    removeEntry: vault.removeEntry,
    removeEntries: vault.removeEntries,
    resolveVaultPathForPath: resolveVaultPathForNotePath,
    refreshModifiedFiles: refreshGitModifiedFiles,
    reloadVault: vault.reloadVault,
    setToastMessage,
  })

  const handleDeleteType = useCallback((typeName: string) => {
    const request = resolveTypeDeleteRequest(vault.entries, typeName)
    if (request.kind === 'blocked') {
      trackEvent('sidebar_type_delete_blocked', {
        reason: request.reason,
        instance_count: request.instanceCount,
      })
      setToastMessage(translate(appLocale, typeDeleteBlockedMessageKey(request), {
        count: request.instanceCount,
        type: typeName,
      }))
      return
    }

    trackEvent('sidebar_type_delete_requested')
    deleteActions.handleDeleteNote(request.typeEntry.path)
  }, [appLocale, deleteActions, vault.entries])

  const shouldLoadGitHistory = !layout.inspectorCollapsed && !effectiveShowAIChat
  const gitHistory = useGitHistory(notes.activeTabPath, loadGitHistoryForPath, shouldLoadGitHistory, gitHistoryRefreshKey)

  const {
    availableFields,
    handleCreateMissingType,
    handleCreateOrUpdateView,
    handleCreateType,
    handleDeleteView,
    handleEditView,
    handleSidebarUpdateViewDefinition,
    handleUpdateViewDefinition,
  } = useAppViewActions({
    editingView: dialogs.editingView,
    graphDefaultWorkspacePath,
    handleSetSelection,
    multiWorkspaceEnabled,
    notes,
    onOpenEditView: dialogs.openEditView,
    resolvedPath,
    selection,
    setToastMessage,
    vault,
    visibleEntries,
  })

  const bulkActions = useBulkActions(entryActions, visibleEntries, setToastMessage)

  const {
    buildNumber,
    diffToggleRef,
    findInNoteRef,
    handleCollapseSidebar,
    handleSetViewMode,
    handleToggleInspector,
    noteListVisible,
    pdfExportRef,
    rawToggleRef,
    sidebarVisible,
    tableOfContentsToggleRef,
    zoom,
  } = useAppWindowControls({
    layout,
    windowMode: Boolean(noteWindowParams),
  })
  const turnCurrentBlockIntoRef = useRef<((target: RichEditorBlockTypeDefinition) => void) | null>(null)

  const { status: updateStatus, actions: updateActions } = useUpdater(
    settings.release_channel,
    areAutomaticUpdateChecksEnabled(settings),
  )

  const handleCheckForUpdates = useCallback(async () => {
    if (updateStatus.state === 'downloading') return
    if (updateStatus.state === 'ready') {
      await restartApp()
      return
    }
    const result = await updateActions.checkForUpdates()
    if (result.kind === 'up-to-date') {
      const checkedChannel = normalizeReleaseChannel(settings.release_channel)
      setToastMessage(`No newer ${checkedChannel} update is available right now`)
    }
  }, [settings.release_channel, updateActions, updateStatus.state])

  const { handleRepairVault, restoreVaultAiGuidance } = useAppVaultMaintenance({
    resolvedPath, reloadVault: vault.reloadVault, refreshVaultAiGuidance, setToastMessage,
  })

  const activeCommandEntry = useMemo(() => {
    if (!notes.activeTabPath) return null
    return notes.tabs.find((tab) => tab.entry.path === notes.activeTabPath)?.entry
      ?? vault.entries.find((entry) => entry.path === notes.activeTabPath)
      ?? null
  }, [notes.activeTabPath, notes.tabs, vault.entries])
  const noteRetargetingUi = useNoteRetargetingUi({
    activeEntry: activeCommandEntry,
    activeNoteBlocked: !!activeDeletedFile,
    entries: visibleEntries,
    folders: vault.folders,
    selection: effectiveSelection,
    setSelection: handleSetSelection,
    setToastMessage,
    vaultPath: resolvedPath,
    updateFrontmatter: notes.handleUpdateFrontmatter,
    moveNoteToFolder: notes.handleMoveNoteToFolder,
  })

  const shouldBlockNeighborhoodEscape = [
    dialogs.showCreateTypeDialog,
    dialogs.showQuickOpen,
    dialogs.showCommandPalette,
    effectiveShowAIChat,
    dialogs.showSettings,
    dialogs.showCloneVault,
    dialogs.showSearch,
    dialogs.showConflictResolver,
    dialogs.showCreateViewDialog,
    noteRetargetingUi.isDialogOpen,
    showFeedback,
  ].some(Boolean)

  useNeighborhoodEscape({
    onBack: handleNeighborhoodHistoryBack,
    selectionRef,
    shouldBlockNeighborhoodEscape,
  })

  const noteListColumnsLabel = useMemo(() => {
    if (effectiveSelection.kind === 'view') {
      const selectedView = vault.views.find((view) => viewMatchesSelection(view, effectiveSelection))
      return selectedView ? `Customize ${selectedView.definition.name} columns` : 'Customize View columns'
    }

    return effectiveSelection.kind === 'filter' && effectiveSelection.filter === 'all'
      ? 'Customize All Notes columns'
      : 'Customize Inbox columns'
  }, [effectiveSelection, vault.views])
  const viewOrdering = useSavedViewOrdering({
    views: vault.views,
    selection: effectiveSelection,
    vaultPath: resolvedPath,
    reloadViews: vault.reloadViews,
    loadModifiedFiles: refreshGitModifiedFiles,
    onToast: setToastMessage,
    locale: appLocale,
  })
  const canReorderSavedViews = useMemo(() => (
    vault.views.every((view) => !view.rootPath)
  ), [vault.views])
  const editorCommands = useAppEditorCommands({
    activeEntry: activeCommandEntry,
    activeNoteDeleted: !!activeDeletedFile,
    activeTabPath: notes.activeTabPath,
    diffToggleRef,
    findInNoteRef,
    pdfExportRef,
    rawToggleRef,
    tableOfContentsToggleRef,
    turnCurrentBlockIntoRef,
  })
  const removeActiveVaultCommand = useCallback(() => {
    vaultSwitcher.removeVault(vaultSwitcher.vaultPath)
  }, [vaultSwitcher])
  const restoreVaultAiGuidanceCommand = useCallback(() => {
    void restoreVaultAiGuidance()
  }, [restoreVaultAiGuidance])
  const changeNoteTypeCommand = useMemo(
    () => noteRetargetingUi.canChangeActiveNoteType ? noteRetargetingUi.openChangeNoteTypeDialog : undefined,
    [noteRetargetingUi.canChangeActiveNoteType, noteRetargetingUi.openChangeNoteTypeDialog],
  )
  const moveNoteToFolderCommand = useMemo(
    () => noteRetargetingUi.canMoveActiveNoteToFolder ? noteRetargetingUi.openMoveNoteToFolderDialog : undefined,
    [noteRetargetingUi.canMoveActiveNoteToFolder, noteRetargetingUi.openMoveNoteToFolderDialog],
  )
  const activeNoteHasIcon = useMemo(() => {
    const entry = vault.entries.find((candidate) => candidate.path === notes.activeTabPath)
    return hasNoteIconValue(entry?.icon)
  }, [notes.activeTabPath, vault.entries])
  const handleToggleOrganizedWithInboxAdvance = useInboxOrganizeAdvance({
    activeTabPath: notes.activeTabPath,
    activeTabPathRef: notes.activeTabPathRef,
    autoAdvanceEnabled: settings.auto_advance_inbox_after_organize === true,
    entries: visibleEntries,
    onSelectNote: notes.handleSelectNote,
    onToggleOrganized: entryActions.handleToggleOrganized,
    requestedActiveTabPathRef: notes.requestedActiveTabPathRef,
    selection: effectiveSelection,
    visibleNotesRef,
  })
  const toggleOrganizedCommand = explicitOrganizationEnabled ? handleToggleOrganizedWithInboxAdvance : undefined
  const canCustomizeNoteListColumns = useMemo(() => (
    canCustomizeColumnsForSelection(effectiveSelection, explicitOrganizationEnabled)
  ), [effectiveSelection, explicitOrganizationEnabled])
  const restoreDeletedNoteCommand = useMemo(
    () => activeDeletedFile ? () => { void handleDiscardFile(activeDeletedFile.relativePath) } : undefined,
    [activeDeletedFile, handleDiscardFile],
  )
  const reloadVaultForCommand = vault.reloadVault
  const handleManualVaultReload = useCallback(async () => {
    const entries = await reloadVaultForCommand()
    setToastMessage(`Vault reloaded (${entries.length} ${entries.length === 1 ? 'entry' : 'entries'})`)
    return entries
  }, [reloadVaultForCommand])

  const {
    activeTab,
    activeTabEntry,
    activeTabContent,
    activeEditorVaultPath,
    defaultNoteWidth,
    handleExportNotePdfFromList,
    noteWidth: activeNoteWidth,
    setDefaultNoteWidth: handleSetDefaultNoteWidth,
    setNoteWidth: handleSetActiveNoteWidth,
    toggleNoteWidth: handleToggleNoteWidth,
  } = useAppActiveEditor({
    tabs: notes.tabs,
    activeTabPath: notes.activeTabPath,
    vaultPath: resolvedPath,
    settings,
    saveSettings,
    updateFrontmatter: notes.handleUpdateFrontmatter,
    setToastMessage,
  }, {
    onSelectNote: notes.handleSelectNote,
    pdfExportRef,
  })

  const {
    isStartupLoading,
    isVaultContentLoading,
    shouldResumeFreshStartOnboarding,
    shouldShowStartupScreen,
  } = useAppWorkspaceStartupState({
    aiAgentsPromptVisible: aiAgentsOnboarding.showPrompt,
    isNoteWindow: Boolean(noteWindowParams),
    onboardingState: onboarding.state,
    runtimeMissingVaultPath,
    selectedVaultPath,
    settingsLoaded,
    showMcpSetupDialog: mcpSetupDialog.open,
    telemetryConsent: settings.telemetry_consent,
    vaultIsLoading: vault.isLoading,
    vaultSwitcher,
  }, {
    enabled: showPrimaryDesktopChrome,
    sidebarVisible,
    zoomLevel: zoom.zoomLevel,
  })
  const deepLinks = useDeepLinks({
    activeEntry: activeTabEntry,
    currentVaultPath: resolvedPath,
    enabled: !noteWindowParams,
    entries: visibleEntries,
    isVaultContentLoading,
    locale: appLocale,
    onSelectNote: notes.handleSelectNote,
    onSwitchVault: vaultSwitcher.switchVault,
    reloadVault: vault.reloadVault,
    setToastMessage,
    vaultListLoaded: vaultSwitcher.loaded,
    vaults: vaultSwitcher.allVaults,
  })
  const noteGitUrls = useNoteGitUrls({
    currentVaultPath: resolvedPath,
    locale: appLocale,
    remoteStatusForRepository: gitSurfaces.remoteStatusForRepository,
    setToastMessage,
  })
  const commandAiActions = useAppCommandAiActions(aiFeaturesEnabled, dialogs, aiAgentsStatus, vaultAiGuidanceStatus, restoreVaultAiGuidanceCommand, aiAgentPreferences)
  const undoCommand = useCallback(() => {
    if (runNativeTextHistoryCommand('undo')) return
    void notes.handleUndo()
  }, [notes])
  const redoCommand = useCallback(() => {
    if (runNativeTextHistoryCommand('redo')) return
    void notes.handleRedo()
  }, [notes])

  const sidebarSync = useAppSidebarSync({
    autoSync,
    gitSurfaces,
    graphDefaultWorkspacePath,
    gitFeaturesEnabled,
    isGitVault,
    offline: networkStatus.isOffline,
    openConflictResolver: conflictFlow.handleOpenConflictResolver,
  })
  const { syncRepositoryPath, handleSyncNow } = sidebarSync

  const handleOpenWorkspacePicker = () => {
    handleSetViewMode('all')
    setWorkspacePickerOpen(true)
  }

  const commands = useAppCommands({
    activeTabPath: notes.activeTabPath, activeTabPathRef: notes.activeTabPathRef,
    entries: visibleEntries,
    visibleNotesRef,
    multiSelectionCommandRef,
    modifiedCount: gitModifiedCount,
    activeNoteModified,
    selection: effectiveSelection,
    onQuickOpen: dialogs.openQuickOpen, onCommandPalette: dialogs.openCommandPalette,
    onSearch: dialogs.openSearch,
    ...editorCommands,
    onCreateNote: notes.handleCreateNoteImmediate,
    onCreateNoteOfType: notes.handleCreateNoteImmediate,
    onSave: appSave.handleSave,
    onUndo: undoCommand,
    onRedo: redoCommand,
    canUndo: notes.canUndo,
    canRedo: notes.canRedo,
    undoLabel: notes.undoLabel,
    redoLabel: notes.redoLabel,
    onOpenSettings: handleOpenSettings,
    onOpenFeedback: openFeedback,
    onOpenDiscord: () => openDiscord('native_menu'),
    onOpenWorkspacePicker: handleOpenWorkspacePicker,
    onSyncNow: handleSyncNow,
    onDeleteNote: deleteActions.handleDeleteNote,
    onArchiveNote: entryActions.handleArchiveNote, onUnarchiveNote: entryActions.handleUnarchiveNote,
    onCommitPush: handleCommitPush,
    onGenerateCommitMessage: commitFlow.openCommitDialogWithGeneratedMessage,
    gitRepositories,
    gitFeaturesEnabled,
    isGitVault,
    onInitializeGit: openGitSetupDialog,
    onPull: handlePullSelectedRepository,
    onPullRepository: handlePullRepository,
    onResolveConflicts: conflictFlow.handleOpenConflictResolver,
    onSetViewMode: handleSetViewMode,
    onToggleInspector: handleToggleInspector,
    noteWidth: activeNoteWidth,
    defaultNoteWidth,
    onSetNoteWidth: handleSetActiveNoteWidth,
    onSetDefaultNoteWidth: handleSetDefaultNoteWidth,
    selectedViewName: viewOrdering.selectedViewName,
    onMoveSelectedViewUp: viewOrdering.onMoveSelectedViewUp,
    onMoveSelectedViewDown: viewOrdering.onMoveSelectedViewDown,
    canMoveSelectedViewUp: viewOrdering.canMoveSelectedViewUp,
    canMoveSelectedViewDown: viewOrdering.canMoveSelectedViewDown,
    onZoomIn: zoom.zoomIn, onZoomOut: zoom.zoomOut, onZoomReset: zoom.zoomReset,
    zoomLevel: zoom.zoomLevel,
    onSelect: handleSetSelection,
    onRenameFolder: folderActions.renameSelectedFolder,
    onDeleteFolder: folderActions.deleteSelectedFolder,
    onRevealSelectedFolder: fileActions.revealSelectedFolder,
    onCopySelectedFolderPath: fileActions.copySelectedFolderPath,
    showInbox: explicitOrganizationEnabled,
    onReplaceActiveTab: notes.handleReplaceActiveTab,
    onSelectNote: notes.handleSelectNote,
    onGoBack: handleGoBack, onGoForward: handleGoForward,
    canGoBack: canGoBack, canGoForward: canGoForward,
    onOpenVault: vaultSwitcher.handleOpenLocalFolder,
    onCreateEmptyVault: vaultSwitcher.handleCreateEmptyVault,
    onCreateType: dialogs.openCreateType,
    ...commandAiActions,
    onCheckForUpdates: handleCheckForUpdates,
    onRemoveActiveVault: removeActiveVaultCommand,
    onRestoreGettingStarted: cloneGettingStartedVault,
    isGettingStartedHidden: vaultSwitcher.isGettingStartedHidden,
    vaultCount: vaultSwitcher.allVaults.length,
    locale: appLocale,
    systemLocale,
    selectedUiLanguage,
    onSetUiLanguage: handleSetUiLanguage,
    onSetThemeMode: handleSetThemeMode,
    mcpStatus: mcpSetupDialog.status,
    onInstallMcp: mcpSetupDialog.openDialog,
    onReloadVault: handleManualVaultReload,
    onRepairVault: handleRepairVault,
    onSetNoteIcon: handleSetNoteIconCommand,
    onRemoveNoteIcon: handleRemoveNoteIconCommand,
    onChangeNoteType: changeNoteTypeCommand,
    onMoveNoteToFolder: moveNoteToFolderCommand,
    canMoveNoteToFolder: noteRetargetingUi.canMoveActiveNoteToFolder,
    activeNoteHasIcon,
    noteListFilter,
    onSetNoteListFilter: setNoteListFilter,
    onOpenInNewWindow: handleOpenInNewWindow,
    onRevealActiveFile: fileActions.revealFile,
    onCopyActiveFilePath: fileActions.copyFilePath,
    onCopyActiveDeepLink: deepLinks.copyPathDeepLink,
    onOpenActiveFileExternal: fileActions.openExternalFile,
    onToggleFavorite: entryActions.handleToggleFavorite,
    onToggleOrganized: toggleOrganizedCommand,
    onCustomizeNoteListColumns: handleCustomizeNoteListColumns,
    canCustomizeNoteListColumns,
    noteListColumnsLabel,
    onRestoreDeletedNote: restoreDeletedNoteCommand,
    canRestoreDeletedNote: !!activeDeletedFile,
  })

  const {
    inboxCount,
    noteList: aiNoteList,
    noteListFilter: aiNoteListFilter,
  } = useAiWorkspacePublishedContext({
    activeTab,
    allNotesFileVisibility,
    context: aiWorkspaceWindowContext,
    effectiveSelection,
    entries: visibleEntries,
    inboxPeriod,
    tabs: notes.tabs,
    views: vault.views,
  })

  const aiWorkspaceSurface = (
    <AppSideAiWorkspace
      activeTab={activeTab}
      tabs={notes.tabs}
      settings={settings}
      saveSettings={saveSettings}
      preferences={aiAgentPreferences}
      aiFeaturesEnabled={aiFeaturesEnabled}
      activeConversationId={lastAiWorkspaceConversationId}
      restoreVaultAiGuidance={restoreVaultAiGuidance}
      open={effectiveShowAIChat}
      aiAgentsStatus={aiAgentsStatus}
      conversationSettingsReady={settingsLoaded}
      entries={visibleEntries}
      noteList={aiNoteList}
      noteListFilter={aiNoteListFilter}
      onActiveConversationChange={handleActiveAiWorkspaceConversationChange}
      onActiveTargetChange={handleActiveAiWorkspaceTargetChange}
      onClose={closeAIChat}
      onOpenAiSettings={handleOpenAiSettings}
      onOpenNote={notes.handleNavigateWikilink}
      onUnsupportedAiPaste={setToastMessage}
      onFileCreated={vaultBridge.handleAgentFileCreated}
      onFileModified={vaultBridge.handleAgentFileModified}
      onVaultChanged={vaultBridge.handleAgentVaultChanged}
      vaultAiGuidanceStatus={vaultAiGuidanceStatus}
      vaultPath={activeEditorVaultPath}
      vaultPaths={writableVaultPaths}
      locale={appLocale}
    />
  )
  const workspaceVaultMenu = createWorkspaceVaultMenu({
    vaultPath: resolvedPath,
    vaultSwitcher,
    multiWorkspaceEnabled,
    locale: appLocale,
    onOpenVaultSettings: handleOpenVaultSettings,
    onCloneVault: dialogs.openCloneVault,
    onCloneGettingStarted: cloneGettingStartedVault,
  })
  const sidebarWorkspaceHeader = (
    <SidebarWorkspaceHeader
      locale={appLocale}
      onSearch={dialogs.openSearch}
      onCreateNote={() => notes.handleCreateNoteImmediate()}
      vaultMenu={{
        ...workspaceVaultMenu,
        open: workspacePickerOpen,
        onOpenChange: setWorkspacePickerOpen,
      }}
    />
  )
  const sidebarUtilities = (
    <WorkspaceSidebarUtilities
      onOpenSettings={handleOpenSettings}
      onContribute={openFeedback}
      onDiscord={() => openDiscord('sidebar')}
      sidebarSync={sidebarSync}
      autoSync={autoSync}
      repositoryActions={gitSurfaces}
      onSelect={handleSetSelection}
      syncMenu={{
        locale: appLocale,
        count: gitModifiedCount,
        canViewGit: isGitVault,
        offline: networkStatus.isOffline,
        repositories: gitRepositories,
      }}
    />
  )

  const confirmNoteDeletion = () => deleteActions.confirmDelete?.onConfirm()

  const workspace = (
    <AppPreferencesProvider appLocale={appLocale} dateDisplayFormat={dateDisplayFormat}>
      <div className="app-shell">
        <AppWorkspacePanes
          desktopChrome={showPrimaryDesktopChrome}
          collectionLayout={collectionLayout}
          noteOpen={Boolean(activeTab)}
          layout={layout}
          hybridSidebar={settings.theme_mode === 'hybrid'}
          highlightedPane={aiActivity.highlightElement}
          onCollapseSidebar={handleCollapseSidebar}
          desktopSidebar={showDesktopSidebarChrome}
          canReorderSavedViews={canReorderSavedViews}
          pluralizeTypeLabels={settings.sidebar_type_pluralization_enabled}
          sidebar={{
            workspaceHeader: sidebarWorkspaceHeader,
            utilities: sidebarUtilities,
            entries: visibleEntries,
            folders: vault.folders,
            views: vault.views,
            selection: effectiveSelection,
            onSelect: handleSetSelection,
            onSelectNote: notes.handleSelectNote,
            onSelectFavorite: handleOpenFavorite,
            onReorderFavorites: entryActions.handleReorderFavorites,
            onCreateType: notes.handleCreateNoteImmediate,
            onCreateNewType: dialogs.openCreateType,
            onCustomizeType: entryActions.handleCustomizeType,
            onUpdateTypeTemplate: entryActions.handleUpdateTypeTemplate,
            onReorderSections: entryActions.handleReorderSections,
            onRenameSection: entryActions.handleRenameSection,
            onDeleteType: handleDeleteType,
            onToggleTypeVisibility: entryActions.handleToggleTypeVisibility,
            onCreateFolder: handleCreateFolder,
            onRenameFolder: folderActions.renameFolder,
            onDeleteFolder: folderActions.requestDeleteFolder,
            folderFileActions: fileActions.folderActions,
            renamingFolderPath: folderActions.renamingFolderPath,
            onStartRenameFolder: folderActions.startFolderRename,
            onCancelRenameFolder: folderActions.cancelFolderRename,
            onCanDropNoteOnFolder: noteRetargetingUi.canDropNoteOnFolder,
            onMoveNoteToFolder: noteRetargetingUi.moveIntoFolder,
            onCreateView: dialogs.openCreateView,
            onEditView: handleEditView,
            onDeleteView: handleDeleteView,
            onUpdateViewDefinition: handleSidebarUpdateViewDefinition,
            onReorderViews: viewOrdering.onReorderViews,
            showInbox: explicitOrganizationEnabled,
            inboxCount,
            allNotesFileVisibility,
            onCollapse: handleCollapseSidebar,
            onGoBack: handleGoBack,
            onGoForward: handleGoForward,
            canGoBack,
            canGoForward,
            locale: appLocale,
            loading: isVaultContentLoading,
            vaultRootPath: resolvedPath,
            workspaceOrder: vaultWorkspaceOrder,
          }}
          list={{
            visible: noteListVisible,
            sidebarVisible,
            isChangesSelection,
            explicitOrganizationEnabled,
            vaultConfig,
            pulse: {
              vaultPath: gitSurfaces.historyRepositoryPath,
              onOpenNote: handlePulseOpenNote,
              refreshKey: gitHistoryRefreshKey,
              onExpandSidebar: () => handleSetViewMode('all'),
              repositories: gitRepositories,
              selectedRepositoryPath: gitSurfaces.historyRepositoryPath,
              onRepositoryChange: gitSurfaces.setHistoryRepositoryPath,
              locale: appLocale,
            },
            notes: {
              entries: visibleEntries,
              selection: effectiveSelection,
              selectedNote: activeTabEntry,
              loading: isVaultContentLoading,
              noteListFilter,
              onNoteListFilterChange: setNoteListFilter,
              inboxPeriod,
              modifiedFiles: selectedChangesModifiedFiles,
              modifiedFilesError: gitSurfaces.changesModifiedFilesError,
              gitRepositories,
              selectedGitRepositoryPath: gitSurfaces.changesRepositoryPath,
              onGitRepositoryChange: gitSurfaces.setChangesRepositoryPath,
              getNoteStatus: vault.getNoteStatus,
              onSelectNote: notes.handleSelectNote,
              onReplaceActiveTab: handleReplaceActiveTabWithQueuedDiff,
              onEnterNeighborhood: handleEnterNeighborhood,
              onCreateNote: notes.handleCreateNoteImmediate,
              onBulkOrganize: bulkActions.handleBulkOrganize,
              onBulkArchive: bulkActions.handleBulkArchive,
              onBulkDeletePermanently: deleteActions.handleBulkDeletePermanently,
              onUpdateTypeSort: notes.handleUpdateFrontmatter,
              onUpdateViewDefinition: handleUpdateViewDefinition,
              updateEntry: vault.updateEntry,
              onOpenInNewWindow: handleOpenEntryInNewWindow,
              onRenameFilename: appSave.handleFilenameRename,
              onExportPdf: handleExportNotePdfFromList,
              onToggleFavorite: entryActions.handleToggleFavorite,
              onToggleOrganized: entryActions.handleToggleOrganized,
              onRevealFile: fileActions.revealFile,
              onCopyFilePath: fileActions.copyFilePath,
              canCopyGitUrl: noteGitUrls.canCopyEntryGitUrl,
              onCopyGitUrl: noteGitUrls.copyEntryGitUrl,
              onDiscardFile: handleDiscardFile,
              onOpenDeletedNote: handleOpenDeletedNote,
              onUpdateAllNotesNoteListProperties: handleUpdateAllNotesNoteListProperties,
              onUpdateInboxNoteListProperties: handleUpdateInboxNoteListProperties,
              views: vault.views,
              vaultPath: resolvedPath,
              visibleNotesRef,
              allNotesFileVisibility,
              multiSelectionCommandRef,
              locale: appLocale,
            },
          }}
          noteActions={{
            deleted: Boolean(activeDeletedFile),
            activeEntry: activeTabEntry,
            gitUrls: noteGitUrls,
            actions: {
              onChangeWorkspace: handleChangeWorkspace,
              onToggleFavorite: entryActions.handleToggleFavorite,
              onToggleOrganized: toggleOrganizedCommand,
              onEnterNeighborhood: handleEnterNeighborhood,
              onCopyDeepLink: deepLinks.copyEntryDeepLink,
              onDeleteNote: deleteActions.handleDeleteNote,
              onArchiveNote: entryActions.handleArchiveNote,
              onUnarchiveNote: entryActions.handleUnarchiveNote,
              onRenameFilename: appSave.handleFilenameRename,
            },
          }}
          editor={{
            tabs: notes.tabs,
            activeTabPath: notes.activeTabPath,
            isVaultLoading: isVaultContentLoading,
            entries: visibleEntries,
            onNavigateWikilink: notes.handleNavigateWikilink,
            onLoadDiff: loadDiffForPath,
            onLoadDiffAtCommit: loadDiffAtCommitForPath,
            pendingCommitDiffRequest: pendingDiffRequest,
            onPendingCommitDiffHandled: handlePendingDiffHandled,
            getNoteStatus: vault.getNoteStatus,
            onCreateNote: notes.handleCreateNoteImmediate,
            inspectorCollapsed: layout.inspectorCollapsed,
            onToggleInspector: handleToggleInspector,
            inspectorWidth: layout.inspectorWidth,
            defaultAiAgent: aiAgentPreferences.defaultAiAgent,
            defaultAiTarget: aiAgentPreferences.defaultAiTarget,
            defaultAiAgentReadiness: aiAgentPreferences.defaultAiAgentReadiness,
            defaultAiAgentReady: aiAgentPreferences.defaultAiAgentReady,
            onUnsupportedAiPaste: setToastMessage,
            onInspectorResize: layout.handleInspectorResize,
            inspectorEntry: activeTabEntry,
            inspectorContent: activeTabContent,
            gitHistory,
            onUpdateFrontmatter: notes.handleUpdateFrontmatter,
            onDeleteProperty: notes.handleDeleteProperty,
            onAddProperty: notes.handleAddProperty,
            onCreateMissingType: handleCreateMissingType,
            onCreateAndOpenNote: notes.handleCreateNoteForRelationship,
            onInitializeProperties: handleInitializeProperties,
            showAIChat: effectiveShowAIChat,
            aiWorkspaceSurface,
            vaultPath: activeEditorVaultPath,
            vaultPaths: writableVaultPaths,
            noteList: aiNoteList,
            noteListFilter: aiNoteListFilter,
            onRevealFile: fileActions.revealFile,
            onCopyFilePath: fileActions.copyFilePath,
            onOpenExternalFile: fileActions.openExternalFile,
            onContentChange: handleTrackedContentChange,
            onSave: handleTrackedSave,
            noteWidth: activeNoteWidth,
            onToggleNoteWidth: handleToggleNoteWidth,
            rawToggleRef,
            tableOfContentsToggleRef,
            pdfExportRef,
            turnCurrentBlockIntoRef,
            findInNoteRef,
            diffToggleRef,
            canGoBack,
            canGoForward,
            onGoBack: handleGoBack,
            onGoForward: handleGoForward,
            onFileCreated: vaultBridge.handleAgentFileCreated,
            onFileModified: vaultBridge.handleAgentFileModified,
            onVaultChanged: vaultBridge.handleAgentVaultChanged,
            workspaces: inspectorWorkspaces,
            isConflicted: conflictFlow.isConflicted,
            onKeepMine: conflictFlow.handleKeepMine,
            onKeepTheirs: conflictFlow.handleKeepTheirs,
            flushPendingEditorContentRef,
            flushPendingRawContentRef,
            onToast: setToastMessage,
            platformCapabilities,
            vaultBackend,
            locale: appLocale,
          }}
          ai={{
            enabled: aiFeaturesEnabled,
            statuses: aiAgentsStatus,
            defaultAgent: aiAgentPreferences.defaultAiAgent,
            defaultTarget: settings.default_ai_target,
            providers: settings.ai_model_providers,
            locale: appLocale,
            updateState: updateStatus.state,
            onOpen: handleToggleAiWorkspace,
          }}
        />
        <AppWorkspaceStatus
          desktopSidebar={showDesktopSidebarChrome}
          primaryDesktopWindow={showPrimaryDesktopChrome}
          vaultReloading={vault.isReloading}
          vaultContentLoading={isVaultContentLoading}
          settingsLoaded={settingsLoaded}
          updaterAvailable={platformCapabilities.updater}
          update={{ status: updateStatus, actions: updateActions, locale: appLocale }}
          rename={{ renames: detectedRenames, onUpdate: handleUpdateWikilinks, onDismiss: handleDismissRenames }}
          gitFeaturesEnabled={gitFeaturesEnabled}
          addRemote={{
            vaultPath: syncRepositoryPath,
            isGitVault,
            refreshRemote: refreshRemoteStatusForRepository,
          }}
          gitSetup={{
            open: shouldShowGitSetupDialog,
            onInitGit: handleInitGitRepo,
            onDismiss: dismissGitSetupDialog,
            onNeverForVault: neverForVaultGitSetupDialog,
          }}
          statusBar={{
            ...workspaceVaultMenu,
            noteCount: visibleEntries.length,
            modifiedCount: gitModifiedCount,
            onOpenSettings: handleOpenSettings,
            onOpenFeedback: openFeedback,
            onOpenDocs: openDocs,
            onClickPending: () => handleSetSelection({ kind: 'filter', filter: 'changes' }),
            onClickPulse: () => handleSetSelection({ kind: 'filter', filter: 'pulse' }),
            onCommitPush: handleCommitPush,
            commitActionPending: commitFlow.isOpeningCommitDialog,
            gitFeaturesEnabled,
            onInitializeGit: openGitSetupDialog,
            isOffline: networkStatus.isOffline,
            isGitVault,
            syncStatus: autoSync.syncStatus,
            lastSyncTime: autoSync.lastSyncTime,
            conflictCount: autoSync.conflictFiles.length,
            remoteStatus: autoSync.remoteStatus,
            repositories: gitRepositories,
            selectedRepositoryPath: gitSurfaces.syncRepositoryPath,
            onRepositoryChange: gitSurfaces.setSyncRepositoryPath,
            onTriggerSync: handlePullSelectedRepository,
            onPullAndPush: handlePullAndPushSelectedRepository,
            onOpenConflictResolver: conflictFlow.handleOpenConflictResolver,
            zoomLevel: zoom.zoomLevel,
            themeMode: documentThemeMode,
            onZoomReset: zoom.zoomReset,
            onToggleThemeMode: handleToggleThemeMode,
            buildNumber,
            onCheckForUpdates: handleCheckForUpdates,
            aiFeaturesEnabled,
            mcpStatus: mcpSetupDialog.status,
            onInstallMcp: mcpSetupDialog.openDialog,
          }}
        />
        <DeleteProgressNotice count={deleteActions.pendingDeleteCount} />
        <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
        <QuickOpenPalette open={dialogs.showQuickOpen} entries={visibleEntries} isLoading={vault.isLoading} onSelect={notes.handleSelectNote} onCreateNote={(title) => notes.handleCreateNote(title, 'Note', 'quick_open')} onClose={dialogs.closeQuickOpen} locale={appLocale} />
        <CommandPalette
          open={dialogs.showCommandPalette}
          commands={commands}
          entries={visibleEntries}
          aiAgentReady={quickPromptTargetReady}
          aiAgentLabel={quickPromptTarget.label}
          aiModeEnabled={aiFeaturesEnabled}
          aiPromptTargetId={quickPromptTarget.id}
          locale={appLocale}
          onClose={dialogs.closeCommandPalette}
        />
        <SearchPanel open={dialogs.showSearch} vaultPath={resolvedPath} entries={visibleEntries} onSelectNote={notes.handleSelectNote} onClose={dialogs.closeSearch} />
        <CreateTypeDialog open={dialogs.showCreateTypeDialog} onClose={dialogs.closeCreateType} onCreate={handleCreateType} />
        <NoteRetargetingDialogs
          dialogState={noteRetargetingUi.dialogState}
          dialogEntry={noteRetargetingUi.dialogEntry}
          typeOptions={noteRetargetingUi.typeOptions}
          folderOptions={noteRetargetingUi.folderOptions}
          onClose={noteRetargetingUi.closeDialog}
          onSelectType={noteRetargetingUi.selectType}
          onSelectFolder={noteRetargetingUi.selectFolder}
        />
        <CreateViewDialog open={dialogs.showCreateViewDialog} onClose={dialogs.closeCreateView} onCreate={handleCreateOrUpdateView} availableFields={availableFields} locale={appLocale} editingView={dialogs.editingView?.definition ?? null} />
        <CommitDialog
          open={commitFlow.showCommitDialog}
          modifiedCount={commitModifiedFiles.length}
          commitMode={commitFlow.commitMode}
          authorIdentity={commitFlow.authorIdentity}
          locale={appLocale}
          repositories={gitRepositories}
          selectedRepositoryPath={gitSurfaces.commitRepositoryPath}
          generatedMessage={commitFlow.generatedCommitMessage}
          generatedMessageKey={commitFlow.generatedCommitMessageKey}
          isGeneratingMessage={commitFlow.isGeneratingCommitMessage}
          suggestedMessage={suggestedCommitMessage}
          onGenerateMessage={commitFlow.generateCommitMessageForDialog}
          onRepositoryChange={gitSurfaces.setCommitRepositoryPath}
          onCommit={commitFlow.handleCommitPush}
          onClose={commitFlow.closeCommitDialog}
        />
        <ConflictResolverModal
          open={dialogs.showConflictResolver}
          fileStates={conflictResolver.fileStates}
          allResolved={conflictResolver.allResolved}
          committing={conflictResolver.committing}
          error={conflictResolver.error}
          onResolveFile={conflictResolver.resolveFile}
          onOpenInEditor={conflictResolver.openInEditor}
          onCommit={conflictResolver.commitResolution}
          onClose={conflictFlow.handleCloseConflictResolver}
        />
        <SettingsPanel open={dialogs.showSettings} initialSectionId={settingsInitialSectionId} settings={settings} aiAgentsStatus={aiAgentsStatus} locale={appLocale} systemLocale={systemLocale} vaults={vaultSwitcher.allVaults} defaultWorkspacePath={vaultSwitcher.defaultWorkspacePath} onSetDefaultWorkspace={vaultSwitcher.setDefaultWorkspace} onRemoveVault={vaultSwitcher.removeVault} onReorderVaults={vaultSwitcher.reorderVaults} onUpdateWorkspaceIdentity={vaultSwitcher.updateWorkspaceIdentity} isGitVault={gitRepoState !== 'missing'} vaultPath={resolvedPath} onSave={saveSettings} onCopyMcpConfig={mcpSetupDialog.copyManualConfig} explicitOrganizationEnabled={explicitOrganizationEnabled} onSaveExplicitOrganization={handleSaveExplicitOrganization} platformCapabilities={platformCapabilities} onClose={dialogs.closeSettings} />
        <AppWorkspaceDialogs
          feedback={{ open: showFeedback, onClose: closeFeedback, locale: appLocale }}
          mcp={{ enabled: platformCapabilities.mcp, controller: mcpSetupDialog, locale: appLocale }}
          clone={{
            open: dialogs.showCloneVault,
            onClose: dialogs.closeCloneVault,
            onVaultCloned: vaultSwitcher.handleVaultCloned,
          }}
          noteDelete={{
            confirmation: deleteActions.confirmDelete,
            onConfirm: confirmNoteDeletion,
            onCancel: () => deleteActions.setConfirmDelete(null),
          }}
          folderDelete={{
            confirmation: folderActions.confirmDeleteFolder,
            onConfirm: folderActions.confirmDeleteSelectedFolder,
            onCancel: folderActions.cancelDeleteFolder,
          }}
        />
      </div>
    </AppPreferencesProvider>
  )

  return (
    <AppWorkspaceStartup
      initialLoadComplete={vault.hasCompletedInitialLoad}
      vaultContentLoading={isVaultContentLoading}
      showStartupScreen={shouldShowStartupScreen}
      startup={{
        aiAgentsOnboarding,
        aiAgentsStatus,
        isOffline: networkStatus.isOffline,
        isStartupLoading,
        locale: appLocale,
        noteWindowParams,
        onboarding,
        runtimeMissingVaultPath,
        saveSettings,
        settings,
        settingsLoaded,
        shouldResumeFreshStartOnboarding,
        showMcpSetupDialog: mcpSetupDialog.open,
        setToastMessage,
        toastMessage,
        vaultSwitcher,
      }}
    >
      {workspace}
    </AppWorkspaceStartup>
  )
}

export default App
