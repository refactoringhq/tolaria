import { type FormEvent, useCallback, useRef, useState } from 'react'
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
  isCloning: boolean
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
  const cloneInFlightRef = useRef(false)
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
    if (cloneInFlightRef.current) return
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
    if (!trimmedUrl || !trimmedPath || cloneInFlightRef.current) return

    cloneInFlightRef.current = true
    setCloneStatus('cloning')
    setCloneError(null)
    let cloneSucceeded = false

    try {
      await tauriCall<string>('clone_git_repo', { url: trimmedUrl, localPath: trimmedPath })
      cloneSucceeded = true
    } catch (error) {
      setCloneStatus('error')
      setCloneError(`Clone failed: ${String(error)}`)
    } finally {
      cloneInFlightRef.current = false
    }

    if (cloneSucceeded) {
      onVaultCloned(trimmedPath, labelFromPath(trimmedPath))
      handleClose()
    }
  }, [handleClose, localPath, onVaultCloned, repoUrl])

  const isCloning = cloneStatus === 'cloning'

  return {
    repoUrl,
    localPath,
    cloneStatus,
    cloneError,
    isCloning,
    isCloneDisabled: !repoUrl.trim() || !localPath.trim() || isCloning,
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
    isCloning,
    isCloneDisabled,
    handleClose,
    handleRepoUrlChange,
    handleLocalPathChange,
    handleClone,
  } = useCloneVaultForm(onClose, onVaultCloned)
  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (!isOpen && !isCloning) handleClose()
  }, [handleClose, isCloning])
  const handleSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void handleClone()
  }, [handleClone])

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

        <form className="flex flex-col gap-4 py-2" onSubmit={handleSubmit} data-testid="clone-vault-form" aria-busy={isCloning}>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground" htmlFor="clone-repo-url">Repository URL</label>
            <Input
              id="clone-repo-url"
              placeholder="git@host:owner/repo.git or https://host/owner/repo.git"
              value={repoUrl}
              disabled={isCloning}
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
              disabled={isCloning}
              onChange={(event) => handleLocalPathChange(event.target.value)}
              data-testid="clone-vault-path"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            {isCloning
              ? 'Cloning repository… Tolaria will open the vault when git finishes.'
              : 'SSH keys, the git credential manager, `gh auth`, and other system git auth methods all work.'}
          </p>

          {cloneError && (
            <p className="text-xs text-destructive" data-testid="clone-vault-error">{cloneError}</p>
          )}

          <DialogFooter className="flex-row items-center justify-end sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isCloning}
              data-testid="clone-vault-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isCloneDisabled}
              data-testid="clone-vault-submit"
            >
              {cloneStatus === 'cloning' ? 'Cloning...' : 'Clone & Open'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
