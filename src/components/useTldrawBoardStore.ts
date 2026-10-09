import { useEffect, useMemo, useRef } from 'react'
import { createTLStore, loadSnapshot, type TLStoreSnapshot } from 'tldraw'
import { installTldrawTextMeasurementGuard } from './tldrawTextMeasurementGuard'

interface BoardStoreOptions {
  boardId: string
  onSnapshotChange: (snapshot: string) => void
  snapshot: string
}

function parseSnapshot(source: string): TLStoreSnapshot | null {
  if (!source.trim()) return null

  try {
    return JSON.parse(source) as TLStoreSnapshot
  } catch {
    return null
  }
}

function serializeSnapshot(snapshot: TLStoreSnapshot): string {
  return `${JSON.stringify(snapshot, null, 2)}\n`
}

function createBoardStore(boardId: string) {
  void boardId
  return createTLStore({ onMount: installTldrawTextMeasurementGuard })
}

export function useTldrawBoardStore({ boardId, onSnapshotChange, snapshot }: BoardStoreOptions) {
  const store = useMemo(() => createBoardStore(boardId), [boardId])
  const savedSnapshotRef = useRef<string | null>(null)
  const savedBoardIdRef = useRef<string | null>(null)
  const onSnapshotChangeRef = useRef(onSnapshotChange)

  useEffect(() => {
    onSnapshotChangeRef.current = onSnapshotChange
  }, [onSnapshotChange])

  useEffect(() => {
    if (boardId === savedBoardIdRef.current && snapshot === savedSnapshotRef.current) return

    const parsed = parseSnapshot(snapshot)
    if (parsed) {
      try {
        loadSnapshot(store, parsed)
        savedBoardIdRef.current = boardId
        savedSnapshotRef.current = snapshot
        return
      } catch {
        // Fall through to an empty board when legacy or hand-edited JSON is invalid.
      }
    }

    const emptySnapshot = createTLStore().getStoreSnapshot()
    loadSnapshot(store, emptySnapshot)
    savedBoardIdRef.current = boardId
    savedSnapshotRef.current = serializeSnapshot(emptySnapshot)
  }, [boardId, snapshot, store])

  useEffect(() => {
    let timeoutId: number | null = null
    const flushSnapshot = () => {
      timeoutId = null
      const nextSnapshot = serializeSnapshot(store.getStoreSnapshot())
      if (nextSnapshot === savedSnapshotRef.current) return

      savedBoardIdRef.current = boardId
      savedSnapshotRef.current = nextSnapshot
      onSnapshotChangeRef.current(nextSnapshot)
    }
    const scheduleSnapshotFlush = () => {
      if (timeoutId !== null) window.clearTimeout(timeoutId)
      timeoutId = window.setTimeout(flushSnapshot, 350)
    }
    const cleanup = store.listen(scheduleSnapshotFlush, { source: 'user', scope: 'document' })
    return () => {
      cleanup()
      if (timeoutId !== null) window.clearTimeout(timeoutId)
    }
  }, [boardId, store])

  return store
}
