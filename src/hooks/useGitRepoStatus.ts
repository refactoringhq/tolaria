import { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri } from '../mock-tauri'

interface GitRepoStatus {
  isGitVault: boolean
  refresh: () => void
}

export function useGitRepoStatus(vaultPath: string | null | undefined): GitRepoStatus {
  const [isGitVault, setIsGitVault] = useState(true)

  const check = useCallback(() => {
    if (!vaultPath) return
    const checkPromise = isTauri()
      ? invoke<boolean>('is_git_repo', { vaultPath })
      : Promise.resolve(true)
    checkPromise
      .then((result) => { setIsGitVault(result) })
      .catch(() => { setIsGitVault(true) })
  }, [vaultPath])

  useEffect(() => {
    check()
  }, [check])

  return { isGitVault, refresh: check }
}
