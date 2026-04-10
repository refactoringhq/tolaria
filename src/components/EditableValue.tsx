import { useState, useCallback, useRef } from 'react'
import { normalizeUrl, openExternalUrl } from '../utils/url'
import { getTagStyle } from '../utils/tagStyles'

export function UrlValue({
  value,
  onSave,
  onCancel,
  isEditing,
  onStartEdit,
}: {
  value: string
  onSave: (newValue: string) => void
  onCancel: () => void
  isEditing: boolean
  onStartEdit: () => void
}) {
  const [editValue, setEditValue] = useState(value)
  const openingRef = useRef(false)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSave(editValue)
    } else if (e.key === 'Escape') {
      setEditValue(value)
      onCancel()
    }
  }

  const handleOpen = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (openingRef.current) return
    openingRef.current = true
    const normalized = normalizeUrl(value)
    try {
      new URL(normalized)
      openExternalUrl(normalized).catch(() => {
        // opener failed — ignore silently
      })
    } catch {
      // malformed URL — do nothing
    } finally {
      setTimeout(() => { openingRef.current = false }, 500)
    }
  }, [value])

  const handleEditClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onStartEdit()
  }, [onStartEdit])

  if (isEditing) {
    return (
      <input
        className="w-full rounded border border-ring bg-muted px-2 py-1 text-[12px] text-foreground outline-none focus:border-primary"
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => onSave(editValue)}
        autoFocus
      />
    )
  }

  return (
    <span className="group/url flex w-full min-w-0 items-center gap-1">
      <span
        className="inline-flex h-6 min-w-0 flex-1 cursor-pointer items-center justify-end overflow-hidden rounded-md px-2 text-right text-[12px] text-[var(--accent-blue)] underline decoration-[var(--accent-blue)]/40 transition-colors hover:decoration-[var(--accent-blue)]"
        onClick={handleOpen}
        title={value}
        data-testid="url-link"
      >
        <span className="min-w-0 truncate">{value || '\u2014'}</span>
      </span>
      <button
        className="shrink-0 border-none bg-transparent p-0 text-[12px] leading-none text-muted-foreground opacity-0 transition-all hover:text-foreground group-hover/url:opacity-100"
        onClick={handleEditClick}
        title="Edit URL"
        data-testid="url-edit-btn"
      >
        &#9998;
      </button>
    </span>
  )
}

export function EditableValue({
  value,
  onSave,
  onCancel,
  isEditing,
  onStartEdit
}: {
  value: string
  onSave: (newValue: string) => void
  onCancel: () => void
  isEditing: boolean
  onStartEdit: () => void
}) {
  const [editValue, setEditValue] = useState(value)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSave(editValue)
    } else if (e.key === 'Escape') {
      setEditValue(value)
      onCancel()
    }
  }

  if (isEditing) {
    return (
      <input
        className="w-full rounded border border-ring bg-muted px-2 py-1 text-[12px] text-foreground outline-none focus:border-primary"
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => onSave(editValue)}
        autoFocus
      />
    )
  }

  return (
    <span
      className="inline-flex h-6 w-full min-w-0 cursor-pointer items-center justify-end overflow-hidden rounded-md px-2 text-right text-[12px] text-secondary-foreground transition-colors hover:bg-muted"
      onClick={onStartEdit}
      title={value || 'Click to edit'}
    >
      <span className="min-w-0 truncate">{value || '\u2014'}</span>
    </span>
  )
}

export function TagPillList({
  items,
  onSave,
  label,
}: {
  items: string[]
  onSave: (newItems: string[]) => void
  label: string
}) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [newValue, setNewValue] = useState('')

  const handleStartEdit = (index: number) => {
    setEditingIndex(index)
    setEditValue(items[index])
  }

  const handleSaveEdit = () => {
    if (editingIndex !== null) {
      const newItems = [...items]
      if (editValue.trim()) {
        newItems[editingIndex] = editValue.trim()
      } else {
        newItems.splice(editingIndex, 1)
      }
      onSave(newItems)
      setEditingIndex(null)
    }
  }

  const handleDeleteItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index)
    onSave(newItems)
  }

  const handleAddNew = () => {
    if (newValue.trim()) {
      onSave([...items, newValue.trim()])
      setNewValue('')
      setIsAddingNew(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent, action: 'edit' | 'add') => {
    if (e.key === 'Enter') {
      if (action === 'edit') handleSaveEdit()
      else handleAddNew()
    } else if (e.key === 'Escape') {
      if (action === 'edit') {
        setEditingIndex(null)
        setEditValue('')
      } else {
        setIsAddingNew(false)
        setNewValue('')
      }
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {items.map((item, idx) =>
        editingIndex === idx ? (
          <input
            key={idx}
            className="rounded-full border border-ring bg-muted px-2 py-0.5 text-[11px] text-foreground outline-none focus:border-primary"
            style={{ width: Math.max(60, editValue.length * 7 + 16) }}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, 'edit')}
            onBlur={handleSaveEdit}
            autoFocus
          />
        ) : (
          <span
            key={idx}
            className="group/pill relative inline-flex h-6 max-w-full min-w-0 cursor-pointer items-center overflow-hidden rounded-md transition-colors"
            style={{
              ...getTagStyle(item),
              backgroundColor: getTagStyle(item).bg,
              padding: '0 8px',
              fontSize: 12,
              fontWeight: 500,
            }}
            onClick={() => handleStartEdit(idx)}
            title="Click to edit"
          >
            <span className="min-w-0 truncate pr-4">{item}</span>
            <button
              className="absolute right-0.5 top-1/2 flex h-3.5 w-3.5 -translate-y-1/2 items-center justify-center rounded-full border-none p-0 text-[10px] leading-none opacity-0 transition-all hover:bg-[var(--accent-red-light)] hover:text-[var(--accent-red)] group-hover/pill:opacity-100"
              style={{ color: getTagStyle(item).color, backgroundColor: getTagStyle(item).bg }}
              onClick={(e) => {
                e.stopPropagation()
                handleDeleteItem(idx)
              }}
              title="Remove"
            >
              &times;
            </button>
          </span>
        )
      )}
      {isAddingNew ? (
        <input
          className="rounded-full border border-ring bg-muted px-2 py-0.5 text-[11px] text-foreground outline-none focus:border-primary"
          style={{ width: Math.max(60, newValue.length * 7 + 16) }}
          type="text"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, 'add')}
          onBlur={() => {
            if (newValue.trim()) handleAddNew()
            else { setIsAddingNew(false); setNewValue('') }
          }}
          placeholder={`${label}...`}
          autoFocus
        />
      ) : (
        <button
          className="inline-flex h-6 items-center justify-center rounded-md border-none bg-muted px-2 text-[12px] font-medium leading-none text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          style={{ padding: '0 8px' }}
          onClick={() => setIsAddingNew(true)}
          title={`Add ${label.toLowerCase()}`}
        >
          +
        </button>
      )}
    </div>
  )
}
