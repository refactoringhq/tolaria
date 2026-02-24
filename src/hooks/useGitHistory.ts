import { useEffect, useState } from 'react'
import type { GitCommit } from '../types'

export function useGitHistory(activeTabPath: string | null, loadGitHistory: (path: string) => Promise<GitCommit[]>) {
  const [gitHistory, setGitHistory] = useState<GitCommit[]>([])

  useEffect(() => {
    if (!activeTabPath) return
    loadGitHistory(activeTabPath).then(setGitHistory)
  }, [activeTabPath, loadGitHistory])

  return activeTabPath ? gitHistory : []
}
