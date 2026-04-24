import { useState } from 'react'
import { GitBranch } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri } from '../mock-tauri'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog'
import { Button } from './ui/button'

interface EnableGitDialogProps {
  open: boolean
  vaultPath: string
  onClose: () => void
  onEnabled: () => void
}

export function EnableGitDialog({ open, vaultPath, onClose, onEnabled }: EnableGitDialogProps) {
  const [enabling, setEnabling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleEnable = async () => {
    setEnabling(true)
    setError(null)
    try {
      if (isTauri()) {
        await invoke('init_git_repo', { vaultPath })
      }
      onEnabled()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setEnabling(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) onClose() }}>
      <DialogContent className="max-w-sm" data-testid="enable-git-dialog">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <GitBranch size={18} className="text-muted-foreground" />
            <DialogTitle>Enable Git for this vault</DialogTitle>
          </div>
          <DialogDescription className="text-[13px] leading-relaxed">
            Tolaria will initialize a local Git repository and make an initial commit of your existing files.
            No remote is needed — you can connect one later from the status bar.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-center text-[12px] text-destructive">
            {error}
          </p>
        )}
        <div className="flex flex-col gap-2 pt-1">
          <Button onClick={handleEnable} disabled={enabling} data-testid="enable-git-confirm">
            {enabling ? 'Enabling…' : 'Enable Git'}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={enabling}>
            Cancel
          </Button>
        </div>
        <p className="text-center text-[11px] text-muted-foreground">
          Want to clone an existing repo instead?{' '}
          <span className="text-foreground">Use Vault → Clone vault.</span>
        </p>
      </DialogContent>
    </Dialog>
  )
}
