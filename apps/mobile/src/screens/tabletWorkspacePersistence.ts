import { useCallback, useContext, useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import { WorkspaceSyncEditorsContext } from '../workspace/workspaceSyncEditors'
import {
  applyMobileWorkspaceEditWithWrites,
  type MobileWorkspaceEdit,
  type MobileWorkspaceWrite,
} from '../workspace/mobileWorkspaceEditing'
import type { MobileWorkspaceSnapshot } from '../workspace/mobileWorkspaceModel'
import type {
  ReadOnlyWorkspaceRepository,
  ReadOnlyWorkspaceRequest,
} from '../workspace/readOnlyWorkspaceRepository'
import {
  emptyMobileWorkspaceHistory,
  mobileWorkspaceHistoryEntry,
  recordMobileWorkspaceHistory,
  type MobileWorkspaceHistoryEntry,
} from './tabletWorkspaceHistory'

type WorkspaceSnapshotRef = MutableRefObject<MobileWorkspaceSnapshot>
type WorkspaceSnapshotSetter = Dispatch<SetStateAction<MobileWorkspaceSnapshot>>
type WorkspaceEditOptions = { recordHistory?: boolean }
type WorkspaceHistory = typeof emptyMobileWorkspaceHistory
type WorkspaceHistorySetter = Dispatch<SetStateAction<WorkspaceHistory>>

export function useWorkspaceEditPipeline({
  repository,
  repositoryRequest,
  snapshot,
}: {
  repository: ReadOnlyWorkspaceRepository
  repositoryRequest?: ReadOnlyWorkspaceRequest
  snapshot: MobileWorkspaceSnapshot
}) {
  const snapshotState = useWorkspaceSnapshotState(snapshot)
  const [workspaceHistory, setWorkspaceHistory] = useState(emptyMobileWorkspaceHistory)
  const applyWorkspaceEdit = useWorkspaceEditApplier({
    repository,
    repositoryRequest,
    setWorkspaceHistory,
    snapshotState,
  })
  const historyControls = useWorkspaceHistoryControls({
    applyWorkspaceEdit,
    setWorkspaceHistory,
    workspaceHistory,
  })
  const reloadWorkspaceSnapshot = useCallback(() => {
    const nextSnapshot = repository.readSnapshot(repositoryRequest)
    snapshotState.replaceWorkspaceSnapshot(nextSnapshot)
    setWorkspaceHistory(emptyMobileWorkspaceHistory)
  }, [repository, repositoryRequest, snapshotState])

  return {
    applyWorkspaceEdit,
    reloadWorkspaceSnapshot,
    workspaceSnapshot: snapshotState.workspaceSnapshot,
    ...historyControls,
  }
}

function useWorkspaceSnapshotState(snapshot: MobileWorkspaceSnapshot) {
  const [workspaceSnapshot, setWorkspaceSnapshot] = useState(snapshot)
  const workspaceSnapshotRef = useRef(workspaceSnapshot)
  const replaceWorkspaceSnapshot = useCallback((nextSnapshot: MobileWorkspaceSnapshot) => {
    updateWorkspaceSnapshot(nextSnapshot, workspaceSnapshotRef, setWorkspaceSnapshot)
  }, [])

  useEffect(() => {
    workspaceSnapshotRef.current = workspaceSnapshot
  }, [workspaceSnapshot])

  return {
    replaceWorkspaceSnapshot,
    setWorkspaceSnapshot,
    workspaceSnapshot,
    workspaceSnapshotRef,
  }
}

function useWorkspaceEditApplier({
  repository,
  repositoryRequest,
  setWorkspaceHistory,
  snapshotState,
}: {
  repository: ReadOnlyWorkspaceRepository
  repositoryRequest?: ReadOnlyWorkspaceRequest
  setWorkspaceHistory: WorkspaceHistorySetter
  snapshotState: ReturnType<typeof useWorkspaceSnapshotState>
}) {
  const syncEditors = useContext(WorkspaceSyncEditorsContext)
  const [generation] = useState(() => syncEditors?.generation())
  return useCallback((edit: MobileWorkspaceEdit, options: WorkspaceEditOptions = {}) => {
    const previousSnapshot = snapshotState.workspaceSnapshotRef.current
    if (generation !== syncEditors?.generation()) return { snapshot: previousSnapshot, writes: [] }
    const result = applyWorkspaceEditToWritableSnapshot(previousSnapshot, edit)
    if (result.writes.length > 0) syncEditors?.markDirty()
    snapshotState.replaceWorkspaceSnapshot(result.snapshot)
    recordWorkspaceEditHistory({ edit, options, previousSnapshot, resultSnapshot: result.snapshot, setWorkspaceHistory })
    if (result.writes.length > 0) void persistWorkspaceWrites({
      repository,
      repositoryRequest,
      setWorkspaceSnapshot: snapshotState.setWorkspaceSnapshot,
      workspaceSnapshotRef: snapshotState.workspaceSnapshotRef,
      writes: result.writes,
    })
    return result
  }, [generation, repository, repositoryRequest, setWorkspaceHistory, snapshotState, syncEditors])
}

export function applyWorkspaceEditToWritableSnapshot(
  snapshot: MobileWorkspaceSnapshot,
  edit: MobileWorkspaceEdit,
) {
  if (snapshot.sync.kind === 'noVault' || snapshot.sync.kind === 'readOnly') return { snapshot, writes: [] }
  return applyMobileWorkspaceEditWithWrites(snapshot, edit)
}

function useWorkspaceHistoryControls({
  applyWorkspaceEdit,
  setWorkspaceHistory,
  workspaceHistory,
}: {
  applyWorkspaceEdit: (edit: MobileWorkspaceEdit, options?: WorkspaceEditOptions) => ReturnType<typeof applyMobileWorkspaceEditWithWrites>
  setWorkspaceHistory: WorkspaceHistorySetter
  workspaceHistory: WorkspaceHistory
}) {
  const applyWorkspaceHistoryEntry = useCallback((entry: MobileWorkspaceHistoryEntry, direction: 'redo' | 'undo') => {
    const edits = direction === 'undo' ? entry.undoEdits : entry.redoEdits
    for (const edit of edits) applyWorkspaceEdit(edit, { recordHistory: false })
  }, [applyWorkspaceEdit])
  const undoWorkspaceEdit = useCallback(() => {
    const entry = latestWorkspaceHistoryEntry(workspaceHistory.past)
    if (!entry) return

    setWorkspaceHistory({
      future: [entry, ...workspaceHistory.future],
      past: workspaceHistory.past.slice(0, -1),
    })
    applyWorkspaceHistoryEntry(entry, 'undo')
  }, [applyWorkspaceHistoryEntry, setWorkspaceHistory, workspaceHistory])
  const redoWorkspaceEdit = useCallback(() => {
    const entry = workspaceHistory.future[0]
    if (!entry) return

    setWorkspaceHistory({
      future: workspaceHistory.future.slice(1),
      past: [...workspaceHistory.past, entry],
    })
    applyWorkspaceHistoryEntry(entry, 'redo')
  }, [applyWorkspaceHistoryEntry, setWorkspaceHistory, workspaceHistory])

  return {
    canRedoWorkspaceEdit: workspaceHistory.future.length > 0,
    canUndoWorkspaceEdit: workspaceHistory.past.length > 0,
    redoWorkspaceEdit,
    undoWorkspaceEdit,
  }
}

function latestWorkspaceHistoryEntry(entries: MobileWorkspaceHistoryEntry[]) {
  return entries.at(-1) ?? null
}

function recordWorkspaceEditHistory({
  edit,
  options,
  previousSnapshot,
  resultSnapshot,
  setWorkspaceHistory,
}: {
  edit: MobileWorkspaceEdit
  options: WorkspaceEditOptions
  previousSnapshot: MobileWorkspaceSnapshot
  resultSnapshot: MobileWorkspaceSnapshot
  setWorkspaceHistory: WorkspaceHistorySetter
}) {
  if (options.recordHistory === false) return

  setWorkspaceHistory((history) => recordMobileWorkspaceHistory(
    history,
    mobileWorkspaceHistoryEntry(previousSnapshot, resultSnapshot, edit),
  ))
}

function updateWorkspaceSnapshot(
  snapshot: MobileWorkspaceSnapshot,
  workspaceSnapshotRef: WorkspaceSnapshotRef,
  setWorkspaceSnapshot: WorkspaceSnapshotSetter,
) {
  workspaceSnapshotRef.current = snapshot
  setWorkspaceSnapshot(snapshot)
}

async function persistWorkspaceWrites({
  repository,
  repositoryRequest,
  setWorkspaceSnapshot,
  workspaceSnapshotRef,
  writes,
}: {
  repository: ReadOnlyWorkspaceRepository
  repositoryRequest?: ReadOnlyWorkspaceRequest
  setWorkspaceSnapshot: WorkspaceSnapshotSetter
  workspaceSnapshotRef: WorkspaceSnapshotRef
  writes: MobileWorkspaceWrite[]
}) {
  try {
    await repository.persistWrites(writes, repositoryRequest)
  } catch {
    markWorkspaceWriteFailed(workspaceSnapshotRef, setWorkspaceSnapshot)
  }
}

function markWorkspaceWriteFailed(
  workspaceSnapshotRef: WorkspaceSnapshotRef,
  setWorkspaceSnapshot: WorkspaceSnapshotSetter,
) {
  setWorkspaceSnapshot((current) => {
    const failedSnapshot = snapshotWithWriteFailure(current)
    workspaceSnapshotRef.current = failedSnapshot
    return failedSnapshot
  })
}

function snapshotWithWriteFailure(snapshot: MobileWorkspaceSnapshot): MobileWorkspaceSnapshot {
  if (snapshot.sync.kind === 'writeFailed') return snapshot

  return {
    ...snapshot,
    sync: { kind: 'writeFailed' },
  }
}
