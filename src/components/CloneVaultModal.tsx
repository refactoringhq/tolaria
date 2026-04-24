import { useCallback, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { isTauri, mockInvoke } from '../mock-tauri'

type CloneStatus = 'idle' | 'cloning' | 'error'

interface CloneVaultModalProps {
  open: boolean
  onClose: () => void
  onVaultCloned: (path: string, label: string) => void
}

interface CloneVaultFormState {
  repoUrl: string
  localPath: string
  cloneStatus: CloneStatus
  cloneError: string | null
  isCloneDisabled: boolean
  handleClose: () => void
  handleRepoUrlChange: (value: string) => void
  handleLocalPathChange: (value: string) => void
  handleClone: () => Promise<void>
}

function tauriCall<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
  return isTauri() ? invoke<T>(cmd, args) : mockInvoke<T>(cmd, args)
}

function repoNameFromUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/g, '')
  if (!trimmed) return ''
  const segment = trimmed.split(/[/:]/).pop() ?? ''
  return segment.replace(/\.git$/i, '')
}

function suggestedPathFromUrl(url: string): string {
  const repoName = repoNameFromUrl(url)
  return repoName ? `~/Vaults/${repoName}` : ''
}

function labelFromPath(path: string): string {
  const trimmed = path.trim().replace(/\/+$/g, '')
  return trimmed.split('/').pop() || 'Vault'
}

function shouldSyncSuggestedPath(localPath: string, pathDirty: boolean, previousSuggestedPath: string): boolean {
  return !pathDirty || !localPath.trim() || localPath === previousSuggestedPath
}

function useCloneVaultForm(onClose: () => void, onVaultCloned: (path: string, label: string) => void): CloneVaultFormState {
  const [repoUrl, setRepoUrl] = useState('')
  const [localPath, setLocalPath] = useState('')
  const [pathDirty, setPathDirty] = useState(false)
  const [cloneStatus, setCloneStatus] = useState<CloneStatus>('idle')
  const [cloneError, setCloneError] = useState<string | null>(null)
  const previousSuggestedPathRef = useRef('')

  const resetState = useCallback(() => {
    setRepoUrl('')
    setLocalPath('')
    setPathDirty(false)
    setCloneStatus('idle')
    setCloneError(null)
    previousSuggestedPathRef.current = ''
  }, [])

  const handleClose = useCallback(() => {
    resetState()
    onClose()
  }, [onClose, resetState])

  const handleRepoUrlChange = useCallback((value: string) => {
    setRepoUrl(value)
    setCloneError(null)

    const nextSuggestedPath = suggestedPathFromUrl(value)
    const previousSuggestedPath = previousSuggestedPathRef.current

    if (shouldSyncSuggestedPath(localPath, pathDirty, previousSuggestedPath)) {
      setLocalPath(nextSuggestedPath)
    }

    previousSuggestedPathRef.current = nextSuggestedPath
  }, [localPath, pathDirty])

  const handleLocalPathChange = useCallback((value: string) => {
    setPathDirty(true)
    setLocalPath(value)
    setCloneError(null)
  }, [])

  const handleClone = useCallback(async () => {
    const trimmedUrl = repoUrl.trim()
    const trimmedPath = localPath.trim()
    if (!trimmedUrl || !trimmedPath) return

    setCloneStatus('cloning')
    setCloneError(null)

    try {
      await tauriCall<string>('clone_git_repo', { url: trimmedUrl, localPath: trimmedPath })
      onVaultCloned(trimmedPath, labelFromPath(trimmedPath))
      handleClose()
    } catch (error) {
      setCloneStatus('error')
      setCloneError(`Clone failed: ${String(error)}`)
    }
  }, [handleClose, localPath, onVaultCloned, repoUrl])

  return {
    repoUrl,
    localPath,
    cloneStatus,
    cloneError,
    isCloneDisabled: !repoUrl.trim() || !localPath.trim() || cloneStatus === 'cloning',
    handleClose,
    handleRepoUrlChange,
    handleLocalPathChange,
    handleClone,
  }
}

export function CloneVaultModal({ open, onClose, onVaultCloned }: CloneVaultModalProps) {
  const {
    repoUrl,
    localPath,
    cloneStatus,
    cloneError,
    isCloneDisabled,
    handleClose,
    handleRepoUrlChange,
    handleLocalPathChange,
    handleClone,
  } = useCloneVaultForm(onClose, onVaultCloned)
  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (!isOpen) handleClose()
  }, [handleClose])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[520px]" data-testid="clone-vault-modal">
        <DialogHeader>
          <DialogTitle>Clone Git Repo</DialogTitle>
          <DialogDescription>
            Clone any remote repository into a local vault folder. Tolaria uses your existing system git
            configuration for authentication.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground" htmlFor="clone-repo-url">Repository URL</label>
            <Input
              id="clone-repo-url"
              placeholder="git@host:owner/repo.git or https://host/owner/repo.git"
              value={repoUrl}
              onChange={(event) => handleRepoUrlChange(event.target.value)}
              data-testid="clone-repo-url"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground" htmlFor="clone-vault-path">Clone to</label>
            <Input
              id="clone-vault-path"
              placeholder="~/Vaults/my-vault"
              value={localPath}
              onChange={(event) => handleLocalPathChange(event.target.value)}
              data-testid="clone-vault-path"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            SSH keys, the git credential manager, `gh auth`, and other system git auth methods all work.
          </p>

          {cloneError && (
            <p className="text-xs text-destructive" data-testid="clone-vault-error">{cloneError}</p>
          )}
        </div>

        <DialogFooter className="flex-row items-center justify-end sm:justify-end">
          <Button
            onClick={handleClone}
            disabled={isCloneDisabled}
            data-testid="clone-vault-submit"
          >
            {cloneStatus === 'cloning' ? 'Cloning...' : 'Clone & Open'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
