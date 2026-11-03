import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { useMobileAnalytics } from '../../analytics/useMobileAnalytics'
import { useMobileSettings } from '../../settings/useMobileSettings'
import { FolderOpenFailure, folderOpenMessage } from '../folderOpenFailure'
import { isWorkspaceLinked, syncLinkedWorkspaceWithEditors } from '../linkedWorkspace'
import { syncFailureKind } from '../syncFailure'
import type { VaultSyncState } from '../syncLedgerModel'
import { useLinkedFolderSync } from '../useLinkedFolderSync'
import { useVaultNotices } from '../useVaultNotices'
import { useVaultSyncLedger } from '../useVaultSyncLedger'
import type { VaultConflictReview } from '../vaultConflictOperations'
import { createWorkspaceSyncEditors } from '../workspaceSyncEditors'
import { gitFileWriteFailurePath } from './expoGitFileSystem'
import { githubFailure } from './githubFailure'
import type { GitAuthor } from './gitVault'
import { managedGitConnection } from './managedGitStorage'
import { createMobileGitCommitTask } from './mobileGitCheckpoint'
import { createMobileVaultConflictActions } from './mobileVaultConflictActions'
import { createMobileVaultSyncTask } from './mobileVaultSyncTask'
import type { ManagedGitVault } from './managedGitVaults'
import type { ManagedLocalVault } from './managedLocalVaults'
import { createMobileVaultCatalogActions, type VaultTask } from './mobileVaultCatalogActions'
import { runSavedVaultOperation } from './savedVaultOperation'
import { useGitCloneProgress } from './useGitCloneProgress'
import { useGitHubAccount } from './useGitHubAccount'
import { useGitSyncProgress } from './useGitSyncProgress'
import { type ActiveVault, useManagedVaultCatalog } from './useManagedVaultCatalog'
import { useMobileAutoGit } from './useMobileAutoGit'
import { usePreparedVaultRefresh } from './usePreparedVaultRefresh'
import { useMobileVaultSelection } from './useMobileVaultSelection'

export type { VaultSyncState } from '../syncLedgerModel'

type VaultError =
  | ReturnType<typeof githubFailure>
  | ReturnType<typeof folderOpenMessage>
  | 'mobile.vaults.saveFailed'
  | 'mobile.vaults.folderUnavailable'
  | 'mobile.vaults.folderConflict'
  | { kind: 'checkoutWrite'; path: string }
  | null

export function useMobileVaults() {
  const state = useMobileVaultState()
  const actions = useMobileVaultActions(state)
  return { ...state, ...actions }
}

function useMobileVaultState() {
  const catalogState = useMobileVaultCatalogState()
  const { catalog, account, cloneProgress, syncProgress, preferences, analytics, editors, active, revision, setRevision, workspaceRefresh } = catalogState
  const [opened, setOpened] = useState(false)
  const [busy, setBusy] = useState(false)
  const [conflictReview, setConflictReview] = useState<VaultConflictReview | null>(null)
  const [conflictFailure, setConflictFailure] = useState<'stale' | 'local' | null>(null)
  const syncHistory = useVaultSyncLedger(activeVaultId(active))
  const notices = useVaultNotices(activeVaultId(active))
  const {
    record: { phase, status, lastCommitId },
    setStatus,
    setPhase,
    setLastCommitId,
  } = syncHistory
  const [error, setError] = useState<VaultError>(null)
  const [operationLock] = useState(createVaultOperationLock)
  const dirtyVersion = useVaultDirtyVersion(editors, syncHistory)
  const restorePending = catalog.pending || !syncHistory.ready
  const linked = !active.git && isWorkspaceLinked(active.selection?.vaultRootUri)
  const open = useCallback(async () => {
    editors.setBlocked(true)
    setOpened(true)
  }, [editors])
  const close = () => {
    if (operationLock.isLocked()) return
    account.cancelSignIn()
    setConflictReview(null)
    editors.setBlocked(false)
    setOpened(false)
  }
  return {
    catalog, account, cloneProgress, syncProgress, analytics, editors, active, revision, setRevision, workspaceRefresh,
    opened, setOpened, busy, setBusy, conflictReview, setConflictReview, conflictFailure, setConflictFailure, syncHistory, notices,
    phase, status, lastCommitId, setPhase, setStatus, setLastCommitId, error, setError, operationLock,
    dirtyVersion, restorePending, linked, open, close, refreshFailed: workspaceRefresh.failed, preferences,
  }
}

function useMobileVaultCatalogState() {
  const catalog = useManagedVaultCatalog()
  const account = useGitHubAccount()
  const cloneProgress = useGitCloneProgress()
  const syncProgress = useGitSyncProgress()
  const preferences = useMobileSettings()
  const analytics = useMobileAnalytics()
  const [editors] = useState(createWorkspaceSyncEditors)
  const selection = useMobileVaultSelection(catalog)
  const refresh = useMobileVaultRefresh(selection.setOverride)
  const { active } = selection
  const { revision, setRevision, workspaceRefresh } = refresh
  return { catalog, account, cloneProgress, syncProgress, preferences, analytics, editors, active, revision, setRevision, workspaceRefresh }
}

function useMobileVaultRefresh(setOverride: (value: ActiveVault) => void) {
  const [revision, setRevision] = useState(0)
  const workspaceRefresh = usePreparedVaultRefresh((next) => {
    setOverride(next)
    setRevision((value) => value + 1)
  })
  return { revision, setRevision, workspaceRefresh }
}

type MobileVaultState = ReturnType<typeof useMobileVaultState>

function useMobileVaultActions(state: MobileVaultState) {
  const perform = useVaultPerformer(state)
  const syncFolder = (root: string) => syncLinkedFolder({
    active: state.active, editors: state.editors, notices: state.notices, setError: state.setError,
    setStatus: state.setStatus, syncHistory: state.syncHistory, workspaceRefresh: state.workspaceRefresh,
  }, root)
  const syncTask = createMobileVaultSyncTask({
    active: state.active,
    account: state.account,
    author: () => mobileGitAuthor(state.account.session),
    deferWhileFocused: automaticSyncInForeground,
    dirtyVersion: state.dirtyVersion,
    editors: state.editors,
    linked: state.linked,
    notices: state.notices,
    setLastCommitId: state.setLastCommitId,
    setPhase: state.setPhase,
    setStatus: state.setStatus,
    syncFolder,
    syncHistory: state.syncHistory,
    syncProgress: state.syncProgress,
    workspaceRefresh: state.workspaceRefresh,
  })
  const conflictActions = createMobileVaultConflictActions({
    active: state.active,
    analytics: state.analytics,
    author: () => mobileGitAuthor(state.account.session),
    autoGit: state.preferences.settings.autoGit,
    busy: state.busy,
    conflictReview: state.conflictReview,
    notices: state.notices,
    perform,
    setConflictFailure: state.setConflictFailure,
    setConflictReview: state.setConflictReview,
    setLastCommitId: state.setLastCommitId,
    setStatus: state.setStatus,
    syncTask,
    syncHistory: state.syncHistory,
  })
  useVaultBackgroundSync({
    active: state.active,
    linked: state.linked,
    editors: state.editors,
    busy: state.busy,
    opened: state.opened,
    restorePending: state.restorePending || state.workspaceRefresh.failed,
    status: state.status,
    syncGit: (signal) => perform(() => syncTask(true, signal), false, 'autoSync', signal),
    syncFolder: (signal) => perform(() => syncTask(false, signal), false, undefined, signal),
  })
  const catalogActions = (present = true) => createMobileVaultCatalogActions({
    active: state.active,
    catalog: state.catalog,
    perform: (task) => perform(task, present),
    capture: state.analytics.capture,
    currentSession: state.account.currentSession,
    runClone: state.cloneProgress.run,
    startClone: () => state.setPhase('clone'),
  })
  return {
    openFolder: () => catalogActions().openFolder(),
    select: (vault: ManagedGitVault, present = true) => catalogActions(present).select(vault),
    selectLocal: (vault: ManagedLocalVault, present = true) => catalogActions(present).selectLocal(vault),
    forget: (id: string) => catalogActions().forget(id),
    clone: (url: string) => catalogActions().clone(url),
    sync: async () => { await perform(() => syncTask(state.preferences.settings.autoGit), false, 'sync') },
    commit: (message: string, push = false) => commitVaultChanges({
      active: state.active, analytics: state.analytics, perform, session: state.account.session,
      setLastCommitId: state.setLastCommitId, setPhase: state.setPhase, setStatus: state.setStatus,
      syncHistory: state.syncHistory, syncTask,
    }, message, push),
    retryWorkspace: () => perform(async () => state.active, false),
    reviewConflicts: conflictActions.reviewConflicts,
    resolveConflicts: conflictActions.resolveConflicts,
    cancelConflictReview: conflictActions.cancelConflictReview,
  }
}

function useVaultPerformer(state: MobileVaultState): PerformVaultTask {
  const {
    active, analytics, editors, linked, notices, restorePending, operationLock, setBusy, setError,
    setOpened, setPhase, setStatus, syncHistory, workspaceRefresh,
  } = state
  return useCallback((task: VaultTask, present = true, operation?: VaultOperation, signal?: AbortSignal) =>
    performVaultOperation({
      active, analytics, editors, linked, notices, restorePending, operationLock, setBusy, setError,
      setOpened, setPhase, setStatus, syncHistory, workspaceRefresh,
    }, { task, present, operation, signal }), [
    active, analytics, editors, linked, notices, restorePending, operationLock, setBusy, setError,
    setOpened, setPhase, setStatus, syncHistory, workspaceRefresh,
  ])
}

type BackgroundSyncOptions = {
  active: ActiveVault
  linked: boolean
  busy: boolean
  opened: boolean
  restorePending: boolean
  status: VaultSyncState
  editors: ReturnType<typeof createWorkspaceSyncEditors>
  syncGit: Parameters<typeof useMobileAutoGit>[0]['sync']
  syncFolder: Parameters<typeof useLinkedFolderSync>[0]['sync']
}

type VaultOperation = 'commit' | 'sync' | 'autoSync'
type PerformVaultTask = (task: VaultTask, present?: boolean, operation?: VaultOperation, signal?: AbortSignal) => Promise<unknown>
type VaultOperationLock = ReturnType<typeof createVaultOperationLock>

function createVaultOperationLock() {
  let locked = false
  return {
    isLocked: () => locked,
    acquire: () => {
      if (locked) return false
      locked = true
      return true
    },
    release: () => { locked = false },
  }
}

type VaultOperationContext = {
  active: ActiveVault
  analytics: ReturnType<typeof useMobileAnalytics>
  editors: ReturnType<typeof createWorkspaceSyncEditors>
  linked: boolean
  notices: ReturnType<typeof useVaultNotices>
  restorePending: boolean
  operationLock: VaultOperationLock
  setBusy: (busy: boolean) => void
  setError: (error: VaultError) => void
  setOpened: (opened: boolean) => void
  setPhase: ReturnType<typeof useVaultSyncLedger>['setPhase']
  setStatus: ReturnType<typeof useVaultSyncLedger>['setStatus']
  syncHistory: ReturnType<typeof useVaultSyncLedger>
  workspaceRefresh: ReturnType<typeof usePreparedVaultRefresh>
}

function beginVaultOperation(context: VaultOperationContext, present: boolean, networkSync: boolean, operation?: VaultOperation) {
  if (operation && context.active.git) context.analytics.capture({ name: 'mobile_git_operation_requested', operation })
  if (operation === 'sync' && context.linked) context.analytics.capture({ name: 'mobile_folder_sync_requested', operation })
  if (!networkSync) context.editors.setBlocked(true)
  context.setBusy(true)
  if (present) context.setOpened(true)
  context.setError(null)
}

function handleVaultFolderFailure(context: VaultOperationContext, failure: FolderOpenFailure, present: boolean, operation?: VaultOperation) {
  context.setError(folderOpenMessage(failure))
  if (operation !== 'sync' && operation !== 'autoSync' && (present || !context.linked)) return 'failed' as const
  context.syncHistory.setProblem('provider')
  context.setStatus('failed')
  if (!present) context.notices.show('provider')
  return 'failed' as const
}

function handleVaultOperationFailure(context: VaultOperationContext, { failure, saved, present, signal, operation }: {
  failure: unknown
  saved: boolean
  present: boolean
  signal?: AbortSignal
  operation?: VaultOperation
}) {
  const interruption = operationInterruption(failure, signal)
  if (interruption) {
    context.setStatus('pending')
    return interruption
  }
  if (failure instanceof FolderOpenFailure) return handleVaultFolderFailure(context, failure, present, operation)
  const kind = syncFailureKind(failure)
  context.syncHistory.setProblem(kind)
  const result = vaultFailure(saved, failure)
  context.setError(result.error)
  if (!present) context.notices.show(saved ? kind : 'saveFailed')
  if (!present && kind === 'retry') {
    context.setStatus('pending')
    return 'retry'
  }
  context.setStatus(result.status)
  return 'failed'
}

function finishVaultOperation(context: VaultOperationContext, networkSync: boolean, present: boolean) {
  context.operationLock.release()
  context.setBusy(false)
  context.setPhase(null)
  if (networkSync || !present) context.editors.setBlocked(false)
}

async function performVaultOperation(context: VaultOperationContext, { task, present = true, operation, signal }: {
  task: VaultTask
  present?: boolean
  operation?: VaultOperation
  signal?: AbortSignal
}) {
  if (context.restorePending || !context.operationLock.acquire()) return
  const networkSync = Boolean(context.active.git && (operation === 'sync' || operation === 'autoSync'))
  beginVaultOperation(context, present, networkSync, operation)
  if (!isCatalogOperation(present, operation)) context.syncHistory.setProblem(null)
  const progress = { saved: false }
  try {
    await executeVaultTask(context, { task, networkSync, signal, progress })
  } catch (failure) {
    return operationRetry(handleVaultOperationFailure(context, { failure, saved: progress.saved, present, signal, operation }))
  } finally {
    finishVaultOperation(context, networkSync, present)
  }
}

async function executeVaultTask(context: VaultOperationContext, { task, networkSync, signal, progress }: {
  task: VaultTask
  networkSync: boolean
  signal?: AbortSignal
  progress: { saved: boolean }
}) {
  if (networkSync) {
    progress.saved = true
    await task()
    return
  }
  let next = context.active
  await runSavedVaultOperation({
    editors: context.editors,
    rootUri: context.active.selection?.vaultRootUri,
    deferWhileFocused: () => automaticSyncInForeground(signal),
    run: async () => {
      progress.saved = true
      return resolveVaultTask(task, context.active, (result) => { next = result })
    },
    refresh: (selectedNoteId) => context.workspaceRefresh.refresh(next, context.active, selectedNoteId),
  })
}

async function syncLinkedFolder(context: Pick<VaultOperationContext, 'active' | 'editors' | 'notices' | 'setError' | 'setStatus' | 'syncHistory' | 'workspaceRefresh'>, root: string) {
  const pendingCheckpoint = context.syncHistory.pendingCheckpoint()
  const result = await syncLinkedWorkspaceWithEditors(root, context.editors, (selectedNoteId) =>
    context.workspaceRefresh.refresh(context.active, context.active, selectedNoteId))
  if (!result.conflict) context.syncHistory.acknowledgePending(pendingCheckpoint)
  context.setStatus(result.conflict ? 'diverged' : 'synced')
  context.syncHistory.setProblem(result.conflict ? 'conflict' : null)
  context.setError(result.conflict ? 'mobile.vaults.folderConflict' : null)
  if (result.conflict) context.notices.show('conflict')
  else context.notices.recovered()
  return result.changed ? null : 'unchanged' as const
}

type CommitVaultContext = {
  active: ActiveVault
  analytics: ReturnType<typeof useMobileAnalytics>
  perform: PerformVaultTask
  session: ReturnType<typeof useGitHubAccount>['session']
  setLastCommitId: ReturnType<typeof useVaultSyncLedger>['setLastCommitId']
  setPhase: ReturnType<typeof useVaultSyncLedger>['setPhase']
  setStatus: ReturnType<typeof useVaultSyncLedger>['setStatus']
  syncHistory: ReturnType<typeof useVaultSyncLedger>
  syncTask: (autoGit: boolean) => ReturnType<VaultTask>
}

async function commitVaultChanges(context: CommitVaultContext, message: string, push: boolean) {
  const checkpoint = createMobileGitCommitTask({
    active: context.active,
    acknowledgePending: context.syncHistory.acknowledgePending,
    author: mobileGitAuthor(context.session),
    captureCommit: () => context.analytics.capture({ name: 'commit_made' }),
    connection: context.active.git ? managedGitConnection(context.active.git) : null,
    message,
    pendingCheckpoint: context.syncHistory.pendingCheckpoint,
    setLastCommitId: context.setLastCommitId,
    setPhase: context.setPhase,
    setStatus: context.setStatus,
  })
  await context.perform(checkpoint.task, true, 'commit')
  if (checkpoint.wasCommitted() && push) await context.perform(() => context.syncTask(false), true, 'sync')
}

function useVaultDirtyVersion(editors: ReturnType<typeof createWorkspaceSyncEditors>, history: ReturnType<typeof useVaultSyncLedger>) {
  const version = useRef(0)
  const { markDirty } = history
  useEffect(
    () =>
      editors.subscribeDirty((paths) => {
        version.current += 1
        // Editing does not resolve a conflict or authorize another automatic sync.
        markDirty(paths)
      }),
    [editors, markDirty]
  )
  return version
}

function useVaultBackgroundSync(options: BackgroundSyncOptions) {
  const preferences = useMobileSettings()
  const blocked = backgroundSyncBlocked(options, preferences.opened)
  const rootUri = options.active.selection?.vaultRootUri
  useMobileAutoGit({
    blocked,
    editors: options.editors,
    rootUri,
    sync: options.syncGit,
    enabled: preferences.ready && preferences.settings.autoGit && Boolean(options.active.git),
  })
  useLinkedFolderSync({
    root: options.linked ? rootUri : undefined,
    blocked: blocked || options.status === 'failed',
    editors: options.editors,
    sync: options.syncFolder,
  })
}

function backgroundSyncBlocked(options: BackgroundSyncOptions, settingsOpened: boolean) {
  return options.busy || options.opened || settingsOpened || options.restorePending || options.status === 'diverged'
}

function automaticSyncInForeground(signal?: AbortSignal) {
  return Boolean(signal) && AppState.currentState === 'active'
}

function operationInterruption(failure: unknown, signal?: AbortSignal) {
  if (failure instanceof Error && failure.message === 'editorSyncDeferred') return 'deferred'
  if (signal?.aborted) return 'cancelled'
}

function operationRetry(outcome: 'retry' | 'deferred' | 'failed' | 'cancelled') {
  if (outcome === 'retry') return { retry: true }
  if (outcome === 'deferred') return { deferred: true }
}

function isCatalogOperation(present: boolean, operation?: 'commit' | 'sync' | 'autoSync') {
  return present && !operation
}

function activeVaultId(active: ActiveVault) {
  return active.git?.id ?? active.selection?.catalogVaultId ?? active.selection?.vaultAlias ?? undefined
}

async function resolveVaultTask(task: VaultTask, active: ActiveVault, select: (next: ActiveVault) => void) {
  const result = await task()
  if (result === 'cancelled' || result === 'unchanged') return result
  select(result ?? active)
}

function vaultFailure(saved: boolean, failure: unknown): { error: VaultError; status: VaultSyncState } {
  if (!saved) return { error: 'mobile.vaults.saveFailed', status: 'saveFailed' }
  if (failure instanceof Error && failure.message === 'linkedFolderUnavailable') return { error: 'mobile.vaults.folderUnavailable', status: 'failed' }
  const path = gitFileWriteFailurePath(failure)
  if (path) return { error: { kind: 'checkoutWrite', path: path.replace(/^\/vault\//u, '') }, status: 'failed' }
  return { error: githubFailure(failure), status: 'failed' }
}

function mobileGitAuthor(session: { login: string; userId: number } | null): GitAuthor {
  return session
    ? {
        name: session.login,
        email: `${session.userId}+${session.login}@users.noreply.github.com`,
      }
    : { name: 'Tolaria mobile', email: 'mobile@tolaria.app' }
}
