import { useState, useRef, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FilterBuilder } from './FilterBuilder'
import { EmojiPicker } from './EmojiPicker'
import { t } from '../lib/i18n'
import type { FilterGroup, ViewDefinition } from '../types'

interface CreateViewDialogProps {
  open: boolean
  onClose: () => void
  onCreate: (definition: ViewDefinition) => void
  availableFields: string[]
  /** When provided, the dialog operates in edit mode with pre-populated fields. */
  editingView?: ViewDefinition | null
}

interface CreateViewDialogFormProps {
  availableFields: string[]
  initialName: string
  initialIcon: string
  initialFilters: FilterGroup
  isEditing: boolean
  onClose: () => void
  onCreate: (definition: ViewDefinition) => void
}

function CreateViewDialogForm({
  availableFields,
  initialName,
  initialIcon,
  initialFilters,
  isEditing,
  onClose,
  onCreate,
}: CreateViewDialogFormProps) {
  const [name, setName] = useState(initialName)
  const [icon, setIcon] = useState(initialIcon)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [filters, setFilters] = useState<FilterGroup>(initialFilters)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => inputRef.current?.focus(), 50)
    return () => window.clearTimeout(timeoutId)
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    const definition: ViewDefinition = {
      name: trimmed,
      icon: icon || null,
      color: null,
      sort: null,
      filters,
    }
    onCreate(definition)
    onClose()
  }

  const handleSelectEmoji = useCallback((emoji: string) => {
    setIcon(emoji)
    setShowEmojiPicker(false)
  }, [])

  const handleCloseEmojiPicker = useCallback(() => {
    setShowEmojiPicker(false)
  }, [])

  const isCreateDisabled = !name.trim()

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex gap-2">
        <div className="w-16 space-y-1.5 relative">
          <label className="text-xs font-medium text-muted-foreground">{t('Icon')}</label>
          <button
            type="button"
            className="flex h-9 w-full items-center justify-center rounded-md border border-input bg-background text-xl cursor-pointer hover:bg-accent transition-colors"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            title={t('Pick icon')}
          >
            {icon || <span className="text-sm text-muted-foreground">📋</span>}
          </button>
          {showEmojiPicker && (
            <EmojiPicker onSelect={handleSelectEmoji} onClose={handleCloseEmojiPicker} />
          )}
        </div>
        <div className="flex-1 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">{t('Name')}</label>
          <Input
            ref={inputRef}
            placeholder={t('e.g. Active Projects, Reading List...')}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
          <label className="text-xs font-medium text-muted-foreground">{t('Filters')}</label>
        <FilterBuilder
          group={filters}
          onChange={setFilters}
          availableFields={availableFields}
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>{t('Cancel')}</Button>
        <Button type="submit" disabled={isCreateDisabled}>{isEditing ? t('Save') : t('Create')}</Button>
      </DialogFooter>
    </form>
  )
}

export function CreateViewDialog({ open, onClose, onCreate, availableFields, editingView }: CreateViewDialogProps) {
  const isEditing = !!editingView
  const initialFilters = editingView?.filters ?? { all: [{ field: availableFields[0] ?? 'type', op: 'equals', value: '' }] }
  const formKey = editingView ? `edit:${editingView.name}` : `create:${availableFields[0] ?? 'type'}`

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent showCloseButton={false} className="flex max-h-[80vh] flex-col sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? t('Edit View') : t('Create View')}</DialogTitle>
          <DialogDescription className="sr-only">
            {isEditing ? t('Update the name, icon, and filters for this saved view.') : t('Create a saved view by choosing a name, icon, and filter rules.')}
          </DialogDescription>
        </DialogHeader>
        {open && (
          <CreateViewDialogForm
            key={formKey}
            availableFields={availableFields}
            initialName={editingView?.name ?? ''}
            initialIcon={editingView?.icon ?? ''}
            initialFilters={initialFilters}
            isEditing={isEditing}
            onClose={onClose}
            onCreate={onCreate}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
