import { GitBranch } from '@phosphor-icons/react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface GitSetupDialogProps {
  open: boolean
  onInitGit: () => Promise<void>
  onDismiss: () => void
  onNeverForVault?: () => void
}

export function GitSetupDialog({ open, onInitGit, onDismiss, onNeverForVault }: GitSetupDialogProps) {
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    setCreating(true)
    setError(null)
    try {
      await onInitGit()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen && !creating) onDismiss()
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-1 flex size-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <GitBranch size={18} />
          </div>
          <DialogTitle>Enable Git for this vault?</DialogTitle>
          <DialogDescription>
            You can keep using this vault without Git. History, sync, commits, and change views stay disabled until you initialize Git.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p className="m-0 rounded-md bg-[var(--feedback-error-bg)] px-3 py-2 text-[12px] text-[var(--accent-red)]">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onNeverForVault} disabled={creating}>
            Never for this vault
          </Button>
          <Button variant="outline" onClick={onDismiss} disabled={creating}>
            Not now
          </Button>
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? 'Initializing…' : 'Initialize Git'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
