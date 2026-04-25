import {
  useState,
  useEffect,
  useCallback,
  type Dispatch,
  type SetStateAction,
} from 'react'

export interface CommitDiffRequest {
  requestId: number
  path: string
  commitHash?: string | null
}

interface UseDiffModeParams {
  activeTabPath: string | null
  onLoadDiff?: (path: string) => Promise<string>
  onLoadDiffAtCommit?: (path: string, commitHash: string) => Promise<string>
  pendingCommitDiffRequest?: CommitDiffRequest | null
  onPendingCommitDiffHandled?: (requestId: number) => void
}

interface DiffStateSetters {
  setDiffMode: Dispatch<SetStateAction<boolean>>
  setDiffContent: Dispatch<SetStateAction<string | null>>
  setDiffLoading: Dispatch<SetStateAction<boolean>>
  setDiffPath: Dispatch<SetStateAction<string | null>>
}

async function loadDiffForPath(
  path: string,
  onLoadDiff: ((path: string) => Promise<string>) | undefined,
  { setDiffMode, setDiffContent, setDiffLoading, setDiffPath }: DiffStateSetters,
) {
  if (!onLoadDiff) return
  setDiffLoading(true)
  try {
    const diff = await onLoadDiff(path)
    setDiffContent(diff)
    setDiffPath(path)
    setDiffMode(true)
  } catch (err) {
    console.warn('Failed to load diff:', err)
  } finally {
    setDiffLoading(false)
  }
}

async function loadCommitDiffForPath(
  path: string,
  commitHash: string,
  onLoadDiffAtCommit: ((path: string, commitHash: string) => Promise<string>) | undefined,
  { setDiffMode, setDiffContent, setDiffLoading, setDiffPath }: DiffStateSetters,
) {
  if (!onLoadDiffAtCommit) return
  setDiffLoading(true)
  try {
    const diff = await onLoadDiffAtCommit(path, commitHash)
    setDiffContent(diff)
    setDiffPath(path)
    setDiffMode(true)
  } catch (err) {
    console.warn('Failed to load commit diff:', err)
  } finally {
    setDiffLoading(false)
  }
}

function shouldHandlePendingCommitDiffRequest(
  activeTabPath: string | null,
  pendingCommitDiffRequest: CommitDiffRequest | null | undefined,
): pendingCommitDiffRequest is CommitDiffRequest {
  return !!pendingCommitDiffRequest && pendingCommitDiffRequest.path === activeTabPath
}

function hasCommitHash(pendingCommitDiffRequest: CommitDiffRequest): pendingCommitDiffRequest is CommitDiffRequest & { commitHash: string } {
  return typeof pendingCommitDiffRequest.commitHash === 'string' && pendingCommitDiffRequest.commitHash.length > 0
}

function buildGuardedDiffStateSetters(
  cancelledRef: { current: boolean },
  { setDiffMode, setDiffContent, setDiffLoading, setDiffPath }: DiffStateSetters,
): DiffStateSetters {
  return {
    setDiffMode: (value) => { if (!cancelledRef.current) setDiffMode(value) },
    setDiffContent: (value) => { if (!cancelledRef.current) setDiffContent(value) },
    setDiffLoading: (value) => { if (!cancelledRef.current) setDiffLoading(value) },
    setDiffPath: (value) => { if (!cancelledRef.current) setDiffPath(value) },
  }
}

function runPendingCommitDiffRequest(
  pendingCommitDiffRequest: CommitDiffRequest,
  onLoadDiff: ((path: string) => Promise<string>) | undefined,
  onLoadDiffAtCommit: ((path: string, commitHash: string) => Promise<string>) | undefined,
  onPendingCommitDiffHandled: ((requestId: number) => void) | undefined,
  diffState: DiffStateSetters,
) {
  const cancelledRef = { current: false }

  const loadDiffPromise = hasCommitHash(pendingCommitDiffRequest)
    ? loadCommitDiffForPath(
      pendingCommitDiffRequest.path,
      pendingCommitDiffRequest.commitHash,
      onLoadDiffAtCommit,
      buildGuardedDiffStateSetters(cancelledRef, diffState),
    )
    : loadDiffForPath(
      pendingCommitDiffRequest.path,
      onLoadDiff,
      buildGuardedDiffStateSetters(cancelledRef, diffState),
    )

  void loadDiffPromise.finally(() => {
    if (cancelledRef.current) return
    onPendingCommitDiffHandled?.(pendingCommitDiffRequest.requestId)
  })

  return () => {
    cancelledRef.current = true
  }
}

function usePendingCommitDiffRequest({
  activeTabPath,
  onLoadDiff,
  onLoadDiffAtCommit,
  pendingCommitDiffRequest,
  onPendingCommitDiffHandled,
  setDiffMode,
  setDiffContent,
  setDiffLoading,
  setDiffPath,
}: UseDiffModeParams & DiffStateSetters) {
  useEffect(() => {
    if (!shouldHandlePendingCommitDiffRequest(activeTabPath, pendingCommitDiffRequest)) return
    if (hasCommitHash(pendingCommitDiffRequest) && !onLoadDiffAtCommit) {
      onPendingCommitDiffHandled?.(pendingCommitDiffRequest.requestId)
      return
    }
    if (!hasCommitHash(pendingCommitDiffRequest) && !onLoadDiff) {
      onPendingCommitDiffHandled?.(pendingCommitDiffRequest.requestId)
      return
    }

    return runPendingCommitDiffRequest(
      pendingCommitDiffRequest,
      onLoadDiff,
      onLoadDiffAtCommit,
      onPendingCommitDiffHandled,
      { setDiffMode, setDiffContent, setDiffLoading, setDiffPath },
    )
  }, [activeTabPath, onLoadDiff, onLoadDiffAtCommit, onPendingCommitDiffHandled, pendingCommitDiffRequest, setDiffContent, setDiffLoading, setDiffMode, setDiffPath])
}

export function useDiffMode({
  activeTabPath,
  onLoadDiff,
  onLoadDiffAtCommit,
  pendingCommitDiffRequest,
  onPendingCommitDiffHandled,
}: UseDiffModeParams) {
  const [diffMode, setDiffMode] = useState(false)
  const [diffContent, setDiffContent] = useState<string | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)
  const [diffPath, setDiffPath] = useState<string | null>(activeTabPath)

  usePendingCommitDiffRequest({
    activeTabPath,
    onLoadDiff,
    onLoadDiffAtCommit,
    pendingCommitDiffRequest,
    onPendingCommitDiffHandled,
    setDiffMode,
    setDiffContent,
    setDiffLoading,
    setDiffPath,
  })

  const isDiffVisible = diffMode && diffPath === activeTabPath

  const handleToggleDiff = useCallback(async () => {
    if (isDiffVisible) {
      setDiffPath(activeTabPath)
      setDiffMode(false)
      setDiffContent(null)
      return
    }
    if (!activeTabPath || !onLoadDiff) return
    await loadDiffForPath(activeTabPath, onLoadDiff, {
      setDiffMode,
      setDiffContent,
      setDiffLoading,
      setDiffPath,
    })
  }, [activeTabPath, isDiffVisible, onLoadDiff, setDiffContent, setDiffLoading, setDiffMode, setDiffPath])

  const handleViewCommitDiff = useCallback(async (commitHash: string) => {
    if (!activeTabPath) return
    await loadCommitDiffForPath(activeTabPath, commitHash, onLoadDiffAtCommit, {
      setDiffMode,
      setDiffContent,
      setDiffLoading,
      setDiffPath,
    })
  }, [activeTabPath, onLoadDiffAtCommit, setDiffContent, setDiffLoading, setDiffMode, setDiffPath])

  return {
    diffMode: isDiffVisible,
    diffContent: isDiffVisible ? diffContent : null,
    diffLoading,
    handleToggleDiff,
    handleViewCommitDiff,
  }
}
