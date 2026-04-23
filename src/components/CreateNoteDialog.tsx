import { useState, useRef, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useI18n } from '../lib/i18n'
import { cn } from '@/lib/utils'

const BUILT_IN_TYPES = [
  'Note',
  'Project',
  'Experiment',
  'Responsibility',
  'Procedure',
  'Person',
  'Event',
  'Topic',
] as const

export type NoteType = (typeof BUILT_IN_TYPES)[number]

interface CreateNoteDialogProps {
  open: boolean
  onClose: () => void
  onCreate: (title: string, type: string) => void
  defaultType?: string
  /** Custom types from the vault (Type documents not in built-in list) */
  customTypes?: string[]
}

export function CreateNoteDialog({ open, onClose, onCreate, defaultType, customTypes = [] }: CreateNoteDialogProps) {
  const { t } = useI18n()
  const [title, setTitle] = useState('')
  const [type, setType] = useState<string>('Note')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on dialog open
      setTitle(''); setType(defaultType ?? 'Note')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open, defaultType])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    onCreate(trimmed, type)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent showCloseButton={false} className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{t('Create New Note')}</DialogTitle>
          <DialogDescription className="sr-only">
            {t('Enter a title and choose a type for the new note.')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {t('Title')}
            </label>
            <Input
              ref={inputRef}
              placeholder={t('Enter note title...')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {t('Type')}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {BUILT_IN_TYPES.map((noteType) => (
                <Button
                  key={noteType}
                  type="button"
                  variant={type === noteType ? 'default' : 'outline'}
                  size="sm"
                  className={cn(
                    "rounded-full text-xs",
                    type === noteType && "bg-primary text-primary-foreground"
                  )}
                  onClick={() => setType(noteType)}
                >
                  {t(noteType)}
                </Button>
              ))}
              {customTypes.map((customType) => (
                <Button
                  key={customType}
                  type="button"
                  variant={type === customType ? 'default' : 'outline'}
                  size="sm"
                  className={cn(
                    "rounded-full text-xs",
                    type === customType
                      ? "bg-[var(--accent-blue)] text-white"
                      : "border-[var(--accent-blue)] text-[var(--accent-blue)]"
                  )}
                  onClick={() => setType(customType)}
                >
                  {customType}
                </Button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('Cancel')}
            </Button>
            <Button type="submit" disabled={!title.trim()}>
              {t('Create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
