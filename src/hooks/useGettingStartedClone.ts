import { useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'
import { formatFolderPickerActionError, pickFolder } from '../utils/vault-dialog'
import {
  buildGettingStartedVaultPath,
  formatGettingStartedCloneError,
  labelFromPath,
} from '../utils/gettingStartedVault'

interface UseGettingStartedCloneOptions {
  onError: (message: string) => void
  onSuccess: (path: string, label: string) => void
}

function tauriCall<T>(command: string, args: Record<string, unknown>): Promise<T> {
  return isTauri() ? invoke<T>(command, args) : mockInvoke<T>(command, args)
}

export function useGettingStartedClone({
  onError,
  onSuccess,
}: UseGettingStartedCloneOptions) {
  return useCallback(async () => {
    let parentPath: string | null
    try {
      parentPath = await pickFolder('Choose a parent folder for the Getting Started vault')
    } catch (err) {
      onError(formatFolderPickerActionError('Could not choose a parent folder', err))
      return
    }

    if (!parentPath) return

    const targetPath = buildGettingStartedVaultPath(parentPath)

    try {
      const vaultPath = await tauriCall<string>('create_getting_started_vault', { targetPath })
      onSuccess(vaultPath, labelFromPath(vaultPath))
    } catch (err) {
      onError(formatGettingStartedCloneError(err))
    }
  }, [onError, onSuccess])
}
