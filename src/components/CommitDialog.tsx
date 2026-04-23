import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { useI18n } from '../lib/i18n'
import type { CommitMode } from '../hooks/useCommitFlow'

type CommitDialogCopy = {
  title: string
  description: string
  actionLabel: string
  shortcutHint: string
}

function getDialogCopy(
  commitMode: CommitMode,
  t: (message: string) => string,
): CommitDialogCopy {
  if (commitMode === 'local') {
    return {
      title: t('Commit'),
      description: t('This vault has no git remote configured. Tolaria will create a local commit only.'),
      actionLabel: t('Commit'),
      shortcutHint: t('Cmd+Enter to commit locally'),
    }
  }

  return {
    title: t('Commit & Push'),
    description: t('Review changed files and enter a commit message before committing and pushing.'),
    actionLabel: t('Commit & Push'),
    shortcutHint: t('Cmd+Enter to commit'),
  }
}

function changedFilesLabel(
  modifiedCount: number,
  t: (message: string, params?: Record<string, string | number | boolean | null | undefined>) => string,
): string {
  return t(modifiedCount === 1 ? '{count} file changed' : '{count} files changed', { count: modifiedCount })
}

function isSubmitShortcut(event: React.KeyboardEvent): boolean {
  return event.key === 'Enter' && (event.metaKey || event.ctrlKey)
}

function isCloseShortcut(event: React.KeyboardEvent): boolean {
  return event.key === 'Escape'
}

interface CommitDialogProps {
  open: boolean
  modifiedCount: number
  commitMode?: CommitMode
  suggestedMessage?: string
  onCommit: (message: string) => void
  onClose: () => void
}

export function CommitDialog({
  open,
  modifiedCount,
  commitMode = 'push',
  suggestedMessage,
  onCommit,
  onClose,
}: CommitDialogProps) {
  const { t } = useI18n()
  const [message, setMessage] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const copy = getDialogCopy(commitMode, t)

  useEffect(() => {
    if (open) {
      setMessage(suggestedMessage ?? '') // eslint-disable-line react-hooks/set-state-in-effect -- reset on dialog open
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps -- only reset when dialog opens

  const handleSubmit = () => {
    const trimmed = message.trim()
    if (!trimmed) return
    onCommit(trimmed)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isSubmitShortcut(e)) {
      e.preventDefault()
      handleSubmit()
    } else if (isCloseShortcut(e)) {
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent showCloseButton={false} className="sm:max-w-[420px]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{copy.title}</DialogTitle>
            <Badge variant="secondary" className="text-xs">
              {changedFilesLabel(modifiedCount, t)}
            </Badge>
          </div>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <Textarea
          ref={inputRef}
          className="min-h-[84px] resize-y bg-[var(--bg-input)] py-2.5 text-[13px]"
          placeholder={t('Commit message...')}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
        />
        <DialogFooter className="flex-row items-center justify-between sm:justify-between">
          <span className="text-[11px] text-muted-foreground">{copy.shortcutHint}</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              {t('Cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={!message.trim()}>
              {copy.actionLabel}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
