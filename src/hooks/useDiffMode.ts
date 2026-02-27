import { useState, useEffect, useCallback } from 'react'

interface UseDiffModeParams {
  activeTabPath: string | null
  onLoadDiff?: (path: string) => Promise<string>
  onLoadDiffAtCommit?: (path: string, commitHash: string) => Promise<string>
}

export function useDiffMode({ activeTabPath, onLoadDiff, onLoadDiffAtCommit }: UseDiffModeParams) {
  const [diffMode, setDiffMode] = useState(false)
  const [diffContent, setDiffContent] = useState<string | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)

  useEffect(() => {
    setDiffMode(false)
    setDiffContent(null)
  }, [activeTabPath])

  const handleToggleDiff = useCallback(async () => {
    if (diffMode) {
      setDiffMode(false)
      setDiffContent(null)
      return
    }
    if (!activeTabPath || !onLoadDiff) return
    setDiffLoading(true)
    try {
      const diff = await onLoadDiff(activeTabPath)
      setDiffContent(diff)
      setDiffMode(true)
    } catch (err) {
      console.warn('Failed to load diff:', err)
    } finally {
      setDiffLoading(false)
    }
  }, [diffMode, activeTabPath, onLoadDiff])

  const handleViewCommitDiff = useCallback(async (commitHash: string) => {
    if (!activeTabPath || !onLoadDiffAtCommit) return
    setDiffLoading(true)
    try {
      const diff = await onLoadDiffAtCommit(activeTabPath, commitHash)
      setDiffContent(diff)
      setDiffMode(true)
    } catch (err) {
      console.warn('Failed to load commit diff:', err)
    } finally {
      setDiffLoading(false)
    }
  }, [activeTabPath, onLoadDiffAtCommit])

  return { diffMode, diffContent, diffLoading, handleToggleDiff, handleViewCommitDiff }
}
