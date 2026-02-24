import { memo, useState, useRef, useCallback, useEffect } from 'react'
import type { VaultEntry } from '../types'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { Plus, Columns, ArrowsOutSimple } from '@phosphor-icons/react'

interface Tab {
  entry: VaultEntry
  content: string
}

interface TabBarProps {
  tabs: Tab[]
  activeTabPath: string | null
  isModified?: (path: string) => boolean
  onSwitchTab: (path: string) => void
  onCloseTab: (path: string) => void
  onCreateNote?: () => void
  onReorderTabs?: (fromIndex: number, toIndex: number) => void
  onRenameTab?: (path: string, newTitle: string) => void
}

const DISABLED_ICON_STYLE = { opacity: 0.4, cursor: 'not-allowed' } as const

// --- Inline edit ---

/** Inline edit input shown when user double-clicks a tab title. */
function InlineTabEdit({ initialValue, onSave, onCancel }: {
  initialValue: string
  onSave: (value: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(initialValue)
  const inputRef = useRef<HTMLInputElement>(null)
  // Guard against double-fire: Enter calls handleSave, then React unmounts
  // the input (editingPath → null), which triggers blur → handleSave again.
  const committedRef = useRef(false)

  useEffect(() => {
    inputRef.current?.select()
  }, [])

  const handleSave = useCallback(() => {
    if (committedRef.current) return
    committedRef.current = true
    const trimmed = value.trim()
    if (trimmed && trimmed !== initialValue) {
      onSave(trimmed)
    } else {
      onCancel()
    }
  }, [value, initialValue, onSave, onCancel])

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') handleSave()
        if (e.key === 'Escape') onCancel()
        e.stopPropagation()
      }}
      onBlur={handleSave}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      style={{
        width: '100%',
        minWidth: 40,
        maxWidth: 150,
        background: 'var(--background)',
        border: '1px solid var(--ring)',
        borderRadius: 3,
        padding: '2px 6px',
        fontSize: 12,
        fontWeight: 500,
        color: 'var(--foreground)',
        outline: 'none',
        fontFamily: 'inherit',
      }}
    />
  )
}

// --- Drag-and-drop helpers ---

function computeDropTarget(dragIdx: number | null, dropIdx: number | null): number | null {
  if (dragIdx === null || dropIdx === null || dragIdx === dropIdx) return null
  const toIndex = dropIdx > dragIdx ? dropIdx - 1 : dropIdx
  return toIndex !== dragIdx ? toIndex : null
}

function computeInsertIndex(e: React.DragEvent<HTMLDivElement>, index: number): number {
  const rect = e.currentTarget.getBoundingClientRect()
  return e.clientX < rect.left + rect.width / 2 ? index : index + 1
}

function useTabDrag(onReorderTabs?: (from: number, to: number) => void) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  // Refs mirror state so event handlers always read the latest values,
  // avoiding stale closures when dragover and drop fire in the same frame.
  const dragIndexRef = useRef<number | null>(null)
  const dropIndexRef = useRef<number | null>(null)
  const dragNodeRef = useRef<HTMLDivElement | null>(null)
  const onReorderRef = useRef(onReorderTabs)
  useEffect(() => { onReorderRef.current = onReorderTabs })

  const resetDrag = useCallback(() => {
    if (dragNodeRef.current) dragNodeRef.current.style.opacity = ''
    dragNodeRef.current = null
    dragIndexRef.current = null
    dropIndexRef.current = null
    setDragIndex(null)
    setDropIndex(null)
  }, [])

  const handleDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, index: number) => {
    dragIndexRef.current = index
    setDragIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
    dragNodeRef.current = e.currentTarget
    requestAnimationFrame(() => {
      if (dragNodeRef.current) dragNodeRef.current.style.opacity = '0.5'
    })
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const currentDrag = dragIndexRef.current
    if (currentDrag === null || currentDrag === index) {
      dropIndexRef.current = null
      setDropIndex(null)
      return
    }
    const idx = computeInsertIndex(e, index)
    dropIndexRef.current = idx
    setDropIndex(idx)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const toIndex = computeDropTarget(dragIndexRef.current, dropIndexRef.current)
    if (toIndex !== null && onReorderRef.current) {
      onReorderRef.current(dragIndexRef.current!, toIndex)
    }
    resetDrag()
  }, [resetDrag])

  const handleBarDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    const related = e.relatedTarget as HTMLElement | null
    if (!e.currentTarget.contains(related)) {
      dropIndexRef.current = null
      setDropIndex(null)
    }
  }, [])

  return { dragIndex, dropIndex, handleDragStart, handleDragEnd: resetDrag, handleDragOver, handleDrop, handleBarDragLeave }
}

// --- Sub-components ---

function DropIndicator({ side }: { side: 'left' | 'right' }) {
  return (
    <div style={{
      position: 'absolute', [side]: -1, top: 8, bottom: 8,
      width: 2, background: 'var(--primary)', borderRadius: 1, zIndex: 10,
    }} />
  )
}

function TabItem({ tab, isActive, isEditing, isModified, isDragging, showDropBefore, showDropAfter, onSwitch, onClose, onDoubleClick, onRenameSave, onRenameCancel, dragProps }: {
  tab: Tab
  isActive: boolean
  isEditing: boolean
  isModified: boolean
  isDragging: boolean
  showDropBefore: boolean
  showDropAfter: boolean
  onSwitch: () => void
  onClose: () => void
  onDoubleClick: () => void
  onRenameSave: (newTitle: string) => void
  onRenameCancel: () => void
  dragProps: React.HTMLAttributes<HTMLDivElement>
}) {
  return (
    <div
      draggable={!isEditing}
      {...dragProps}
      className={cn(
        "group flex shrink-0 items-center gap-1.5 whitespace-nowrap max-w-[180px] transition-all relative",
        isActive ? "text-foreground" : "text-muted-foreground hover:text-secondary-foreground"
      )}
      style={{
        background: isActive ? 'var(--background)' : 'transparent',
        borderRight: `1px solid ${isActive ? 'var(--border)' : 'var(--sidebar-border)'}`,
        borderBottom: isActive ? 'none' : '1px solid var(--sidebar-border)',
        padding: '0 12px', fontSize: 12,
        fontWeight: isActive ? 500 : 400,
        cursor: isEditing ? 'default' : isDragging ? 'grabbing' : 'grab',
        WebkitAppRegion: 'no-drag',
      } as React.CSSProperties}
      onClick={() => !isEditing && onSwitch()}
    >
      {showDropBefore && <DropIndicator side="left" />}
      {isEditing ? (
        <InlineTabEdit initialValue={tab.entry.title} onSave={onRenameSave} onCancel={onRenameCancel} />
      ) : (
        <span className="truncate" onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick() }}>
          {tab.entry.title}
        </span>
      )}
      {isModified && (
        <span
          className="shrink-0"
          style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-orange)' }}
          data-testid="tab-modified-indicator"
          title="Modified (uncommitted)"
        />
      )}
      <button
        className={cn(
          "shrink-0 rounded-sm p-0 bg-transparent border-none text-muted-foreground cursor-pointer transition-opacity hover:bg-accent hover:text-foreground",
          isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}
        style={{ lineHeight: 0 }}
        draggable={false}
        onClick={(e) => { e.stopPropagation(); onClose() }}
      >
        <X size={14} />
      </button>
      {showDropAfter && <DropIndicator side="right" />}
    </div>
  )
}

function TabBarActions({ onCreateNote }: { onCreateNote?: () => void }) {
  return (
    <div
      className="flex shrink-0 items-center"
      style={{
        borderLeft: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
        gap: 12, padding: '0 12px', WebkitAppRegion: 'no-drag',
      } as React.CSSProperties}
    >
      <button className="flex items-center justify-center border-none bg-transparent p-0 text-muted-foreground cursor-pointer hover:text-foreground transition-colors" onClick={() => onCreateNote?.()} title="New note">
        <Plus size={16} />
      </button>
      <button className="flex items-center justify-center border-none bg-transparent p-0 text-muted-foreground" style={DISABLED_ICON_STYLE} title="Coming soon" tabIndex={-1}>
        <Columns size={16} />
      </button>
      <button className="flex items-center justify-center border-none bg-transparent p-0 text-muted-foreground" style={DISABLED_ICON_STYLE} title="Coming soon" tabIndex={-1}>
        <ArrowsOutSimple size={16} />
      </button>
    </div>
  )
}

// --- Main TabBar ---

export const TabBar = memo(function TabBar({
  tabs, activeTabPath, isModified, onSwitchTab, onCloseTab, onCreateNote, onReorderTabs, onRenameTab,
}: TabBarProps) {
  const { dragIndex, dropIndex, handleDragStart, handleDragEnd, handleDragOver, handleDrop, handleBarDragLeave } = useTabDrag(onReorderTabs)
  const [editingPath, setEditingPath] = useState<string | null>(null)

  return (
    <div
      className="flex shrink-0 items-stretch"
      style={{ height: 45, background: 'var(--sidebar)', WebkitAppRegion: 'drag' } as React.CSSProperties}
      data-tauri-drag-region
      onDragLeave={handleBarDragLeave}
    >
      {tabs.map((tab, index) => (
        <TabItem
          key={tab.entry.path}
          tab={tab}
          isActive={tab.entry.path === activeTabPath}
          isEditing={editingPath === tab.entry.path}
          isModified={isModified?.(tab.entry.path) ?? false}
          isDragging={dragIndex !== null}
          showDropBefore={dropIndex === index}
          showDropAfter={dropIndex === index + 1 && index === tabs.length - 1}
          onSwitch={() => onSwitchTab(tab.entry.path)}
          onClose={() => onCloseTab(tab.entry.path)}
          onDoubleClick={() => onRenameTab && setEditingPath(tab.entry.path)}
          onRenameSave={(newTitle) => { setEditingPath(null); onRenameTab?.(tab.entry.path, newTitle) }}
          onRenameCancel={() => setEditingPath(null)}
          dragProps={{
            onDragStart: (e) => handleDragStart(e, index),
            onDragEnd: handleDragEnd,
            onDragOver: (e) => handleDragOver(e, index),
            onDrop: handleDrop,
          }}
        />
      ))}
      <div className="flex-1" style={{ borderBottom: '1px solid var(--border)' }} />
      <TabBarActions onCreateNote={onCreateNote} />
    </div>
  )
})
