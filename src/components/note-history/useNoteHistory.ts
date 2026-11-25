import { useCallback, useEffect, useMemo, useState } from 'react'
import type { NoteCheckpoint } from '../../../packages/protocol/src/index'
import { type DiffLine, isComparable, lineDiff } from '../../lib/noteHistory/lineDiff'
import { currentNoteContent, noteHistoryClient, type RemoteNoteHistory } from '../../lib/noteHistory/noteHistoryClient'
import { trackEvent } from '../../lib/telemetry'

/** Something the drawer fetches: still coming, there, or failed. */
export type Loaded<T> = { status: 'loading' } | { status: 'ready'; value: T } | { status: 'failed' }

export interface CheckpointPreview {
  checkpointId: string
  /** From the current note to the checkpoint: what a restore would change. Null when too large to compare. */
  diff: DiffLine[] | null
}

export type RestoreState = 'idle' | 'restoring' | 'restored' | 'unchanged' | 'failed'

export interface NoteHistoryModel {
  checkpoints: Loaded<NoteCheckpoint[]>
  selectedId: string | null
  preview: Loaded<CheckpointPreview> | null
  restoreState: RestoreState
  select(checkpointId: string): void
  restore(): void
}

const LOADING = { status: 'loading' } as const
const FAILED = { status: 'failed' } as const

/**
 * Runs `load` whenever it or `revision` changes and keeps only the answer of the latest run.
 * While a newer run is on its way, the previous answer stays: a reload does not blank the drawer.
 */
function useLoaded<T>(load: (() => Promise<T>) | null, revision: number): Loaded<T> | null {
  const [state, setState] = useState<{ load: typeof load; loaded: Loaded<T> } | null>(null)
  useEffect(() => {
    if (!load) return
    let current = true
    load().then(
      (value) => { if (current) setState({ load, loaded: { status: 'ready', value } }) },
      () => { if (current) setState({ load, loaded: FAILED }) },
    )
    return () => { current = false }
  }, [load, revision])
  if (!load) return null
  return state?.load === load ? state.loaded : LOADING
}

async function previewOf(client: RemoteNoteHistory, path: string, checkpointId: string): Promise<CheckpointPreview> {
  const [checkpoint, current] = await Promise.all([client.read(path, checkpointId), currentNoteContent(path)])
  const versions = { from: current, to: checkpoint }
  return { checkpointId, diff: isComparable(versions) ? lineDiff(versions) : null }
}

/**
 * Restoring is the server's decision: `POST /v1/restore` requires write access to the note and
 * answers a viewer 403 (apps/server/src/routes.ts, apps/server/test/noteHistory.test.ts). Hiding
 * the button from viewers is only the UI side of that; a refusal shows as a failed restore.
 */
function useRestore(client: RemoteNoteHistory | null, path: string, selectedId: string | null, onRestored: () => void) {
  const [restoreState, setRestoreState] = useState<RestoreState>('idle')
  const restore = useCallback(() => {
    if (!client || !selectedId) return
    setRestoreState('restoring')
    client.restore(path, selectedId).then(
      (outcome) => {
        trackEvent('note_history_restored', { outcome })
        setRestoreState(outcome)
        onRestored()
      },
      () => {
        trackEvent('note_history_restore_failed')
        setRestoreState('failed')
      },
    )
  }, [client, onRestored, path, selectedId])
  return { restoreState, setRestoreState, restore }
}

/** The history of the note at `path`: its checkpoints, the selected one compared with the note, and restore. */
export function useNoteHistory(path: string): NoteHistoryModel {
  const client = useMemo(() => noteHistoryClient(), [])
  const [revision, setRevision] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const refresh = useCallback(() => setRevision((current) => current + 1), [])
  const { restoreState, setRestoreState, restore } = useRestore(client, path, selectedId, refresh)

  const loadCheckpoints = useMemo(() => (client ? () => client.list(path) : null), [client, path])
  const loadPreview = useMemo(
    () => (client && selectedId ? () => previewOf(client, path, selectedId) : null),
    [client, path, selectedId],
  )

  useEffect(() => { trackEvent('note_history_opened') }, [])

  const select = useCallback((checkpointId: string) => {
    trackEvent('note_history_previewed')
    setSelectedId(checkpointId)
    setRestoreState('idle')
  }, [setRestoreState])

  return {
    // `revision` reloads both after a restore added a checkpoint.
    checkpoints: useLoaded(loadCheckpoints, revision) ?? FAILED,
    selectedId,
    preview: useLoaded(loadPreview, revision),
    restoreState,
    select,
    restore,
  }
}
