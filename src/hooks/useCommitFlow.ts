import { useCallback, useRef, useState, type MutableRefObject } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { GitPushResult, GitRemoteStatus, ModifiedFile } from '../types'
import { t } from '../lib/i18n'
import { trackEvent } from '../lib/telemetry'
import { isTauri, mockInvoke } from '../mock-tauri'
import { generateAutomaticCommitMessage } from '../utils/automaticCommitMessage'

export type CommitMode = 'push' | 'local'

interface LocalCommitResult {
  status: 'local_only'
  message: string
}

type CommitResult = GitPushResult | LocalCommitResult
type CheckpointAction = 'commit' | 'push_only'

interface AutomaticCheckpointOptions {
  savePendingBeforeCommit?: boolean
}

interface CommitFlowConfig {
  savePending: () => Promise<void | boolean>
  loadModifiedFiles: () => Promise<void>
  resolveRemoteStatus: () => Promise<GitRemoteStatus | null>
  setToastMessage: (msg: string | null) => void
  onPushRejected?: () => void
  vaultPath: string
}

interface VaultPathArgs {
  vaultPath: string
}

interface CommitArgs extends VaultPathArgs {
  message: string
}

interface CommitExecutionArgs extends CommitArgs {
  commitMode: CommitMode
}

interface AutomaticCheckpointContext extends VaultPathArgs {
  remoteStatus: GitRemoteStatus | null
}

interface AutomaticCheckpointCommand extends AutomaticCheckpointContext {
  action: CheckpointAction
  message?: string
}

interface ExecutedCheckpoint {
  action: CheckpointAction
  result: CommitResult
}

function commitModeFromRemoteStatus(remoteStatus: GitRemoteStatus | null): CommitMode {
  return remoteStatus?.hasRemote === false ? 'local' : 'push'
}

async function commitLocally({ vaultPath, message }: CommitArgs): Promise<void> {
  if (!isTauri()) {
    await mockInvoke<string>('git_commit', { vaultPath, message })
    return
  }

  await invoke<string>('git_commit', { vaultPath, message })
}

async function pushCommittedChanges({ vaultPath }: VaultPathArgs): Promise<GitPushResult> {
  if (!isTauri()) {
    return mockInvoke<GitPushResult>('git_push', { vaultPath })
  }

  return invoke<GitPushResult>('git_push', { vaultPath })
}

async function readModifiedFiles({ vaultPath }: VaultPathArgs): Promise<ModifiedFile[]> {
  if (!isTauri()) {
    return mockInvoke<ModifiedFile[]>('get_modified_files', { vaultPath })
  }

  return invoke<ModifiedFile[]>('get_modified_files', { vaultPath })
}

async function executeCommitAction({
  vaultPath,
  message,
  commitMode,
}: CommitExecutionArgs): Promise<CommitResult> {
  await commitLocally({ vaultPath, message })
  if (commitMode === 'local') {
    return { status: 'local_only', message: t('Committed locally (no remote configured)') }
  }

  return pushCommittedChanges({ vaultPath })
}

function commitToastMessage(result: CommitResult): string {
  if (result.status === 'ok') return t('Committed and pushed')
  if (result.status === 'local_only') return result.message
  if (result.status === 'rejected') return t('Committed, but push rejected — remote has new commits. Pull first.')
  return result.message
}

function isPushRejected(result: CommitResult): boolean {
  return result.status === 'rejected'
}

function formatCommitError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function shouldRetryPush(remoteStatus: GitRemoteStatus | null): boolean {
  return remoteStatus?.hasRemote === true && remoteStatus.ahead > 0
}

function nothingToCommitToast(remoteStatus: GitRemoteStatus | null): string {
  return remoteStatus?.hasRemote === false ? t('Nothing to commit') : t('Nothing to commit or push')
}

function checkpointToastMessage(result: CommitResult, action: CheckpointAction): string {
  if (action === 'push_only') {
    if (result.status === 'ok') return t('Pushed committed changes')
    if (result.status === 'rejected') return t('Push rejected — remote has new commits. Pull first.')
    return result.message
  }

  return commitToastMessage(result)
}

function createAutomaticCheckpointCommand({
  remoteStatus,
  vaultPath,
  message,
}: AutomaticCheckpointContext & { message: string }): AutomaticCheckpointCommand | null {
  if (message.length > 0) {
    return { action: 'commit', remoteStatus, vaultPath, message }
  }

  if (shouldRetryPush(remoteStatus)) {
    return { action: 'push_only', remoteStatus, vaultPath }
  }

  return null
}

async function executeAutomaticCheckpoint(
  command: AutomaticCheckpointCommand,
): Promise<ExecutedCheckpoint> {
  if (command.action === 'push_only') {
    return {
      action: 'push_only',
      result: await pushCommittedChanges({ vaultPath: command.vaultPath }),
    }
  }

  const result = await executeCommitAction({
    vaultPath: command.vaultPath,
    message: command.message ?? '',
    commitMode: commitModeFromRemoteStatus(command.remoteStatus),
  })
  trackEvent('commit_made')
  return { action: 'commit', result }
}

async function runCheckpointRefresh({
  loadModifiedFiles,
  resolveRemoteStatus,
}: Pick<CommitFlowConfig, 'loadModifiedFiles' | 'resolveRemoteStatus'>): Promise<void> {
  await loadModifiedFiles()
  await resolveRemoteStatus()
}

async function finalizeCheckpoint({
  result,
  toastMessage,
  loadModifiedFiles,
  resolveRemoteStatus,
  setToastMessage,
  onPushRejected,
}: Pick<CommitFlowConfig, 'loadModifiedFiles' | 'resolveRemoteStatus' | 'setToastMessage' | 'onPushRejected'> & {
  result: CommitResult
  toastMessage: string
}): Promise<void> {
  setToastMessage(toastMessage)
  if (isPushRejected(result)) {
    onPushRejected?.()
  }

  await runCheckpointRefresh({ loadModifiedFiles, resolveRemoteStatus })
}

function useAutomaticCheckpointAction({
  checkpointInFlightRef,
  savePending,
  loadModifiedFiles,
  resolveRemoteStatus,
  setToastMessage,
  onPushRejected,
  vaultPath,
}: CommitFlowConfig & {
  checkpointInFlightRef: MutableRefObject<boolean>
}) {
  return useCallback(async ({
    savePendingBeforeCommit = false,
  }: AutomaticCheckpointOptions = {}): Promise<boolean> => {
    if (checkpointInFlightRef.current) return false
    checkpointInFlightRef.current = true

    try {
      if (savePendingBeforeCommit) {
        await savePending()
      }

      const remoteStatus = await resolveRemoteStatus()
      const modifiedFiles = await readModifiedFiles({ vaultPath })
      const message = generateAutomaticCommitMessage(modifiedFiles)
      const command = createAutomaticCheckpointCommand({ remoteStatus, vaultPath, message })
      if (!command) {
        setToastMessage(nothingToCommitToast(remoteStatus))
        return false
      }

      const { action, result } = await executeAutomaticCheckpoint(command)
      await finalizeCheckpoint({
        result,
        toastMessage: checkpointToastMessage(result, action),
        loadModifiedFiles,
        resolveRemoteStatus,
        setToastMessage,
        onPushRejected,
      })
      return true
    } catch (err) {
      console.error('Commit failed:', err)
      setToastMessage(t('Commit failed: {error}', { error: formatCommitError(err) }))
      return false
    } finally {
      checkpointInFlightRef.current = false
    }
  }, [checkpointInFlightRef, loadModifiedFiles, onPushRejected, resolveRemoteStatus, savePending, setToastMessage, vaultPath])
}

function useManualCommitPushAction({
  checkpointInFlightRef,
  savePending,
  loadModifiedFiles,
  resolveRemoteStatus,
  setToastMessage,
  onPushRejected,
  vaultPath,
  setShowCommitDialog,
}: CommitFlowConfig & {
  checkpointInFlightRef: MutableRefObject<boolean>
  setShowCommitDialog: (open: boolean) => void
}) {
  return useCallback(async (message: string) => {
    setShowCommitDialog(false)
    if (checkpointInFlightRef.current) return
    checkpointInFlightRef.current = true

    try {
      await savePending()
      const remoteStatus = await resolveRemoteStatus()
      const result = await executeCommitAction({
        vaultPath,
        message,
        commitMode: commitModeFromRemoteStatus(remoteStatus),
      })

      trackEvent('commit_made')
      await finalizeCheckpoint({
        result,
        toastMessage: commitToastMessage(result),
        loadModifiedFiles,
        resolveRemoteStatus,
        setToastMessage,
        onPushRejected,
      })
    } catch (err) {
      console.error('Commit failed:', err)
      setToastMessage(t('Commit failed: {error}', { error: formatCommitError(err) }))
    } finally {
      checkpointInFlightRef.current = false
    }
  }, [checkpointInFlightRef, loadModifiedFiles, onPushRejected, resolveRemoteStatus, savePending, setShowCommitDialog, setToastMessage, vaultPath])
}

/** Manages the commit dialog state and the save→commit→push/local flow. */
export function useCommitFlow({
  savePending,
  loadModifiedFiles,
  resolveRemoteStatus,
  setToastMessage,
  onPushRejected,
  vaultPath,
}: CommitFlowConfig) {
  const [showCommitDialog, setShowCommitDialog] = useState(false)
  const [commitMode, setCommitMode] = useState<CommitMode>('push')
  const checkpointInFlightRef = useRef(false)

  const openCommitDialog = useCallback(async () => {
    await savePending()
    await loadModifiedFiles()
    const remoteStatus = await resolveRemoteStatus()
    setCommitMode(commitModeFromRemoteStatus(remoteStatus))
    setShowCommitDialog(true)
  }, [loadModifiedFiles, resolveRemoteStatus, savePending])

  const runAutomaticCheckpoint = useAutomaticCheckpointAction({
    checkpointInFlightRef,
    savePending,
    loadModifiedFiles,
    resolveRemoteStatus,
    setToastMessage,
    onPushRejected,
    vaultPath,
  })

  const handleCommitPush = useManualCommitPushAction({
    checkpointInFlightRef,
    savePending,
    loadModifiedFiles,
    resolveRemoteStatus,
    setToastMessage,
    onPushRejected,
    vaultPath,
    setShowCommitDialog,
  })

  const closeCommitDialog = useCallback(() => setShowCommitDialog(false), [])

  return { showCommitDialog, commitMode, openCommitDialog, handleCommitPush, closeCommitDialog, runAutomaticCheckpoint }
}
