import { useState, useMemo, useRef, useEffect, useCallback, memo, type ComponentType } from 'react'
import type { VaultEntry, SidebarSelection } from '../types'
import { cn } from '@/lib/utils'
import { ChevronRight, ChevronDown, GitCommitHorizontal, Plus, SlidersHorizontal, GripVertical } from 'lucide-react'
import { getTypeColor, getTypeLightColor } from '../utils/typeColors'
import { resolveIcon, TypeCustomizePopover } from './TypeCustomizePopover'
import { useSectionVisibility } from '../hooks/useSectionVisibility'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  FileText,
  Star,
  Wrench,
  Flask,
  Target,
  ArrowsClockwise,
  Users,
  CalendarBlank,
  Tag,
  TagSimple,
  Trash,
  StackSimple,
  Archive,
  type IconProps,
} from '@phosphor-icons/react'

interface SidebarProps {
  entries: VaultEntry[]
  selection: SidebarSelection
  onSelect: (selection: SidebarSelection) => void
  onSelectNote?: (entry: VaultEntry) => void
  onCreateType?: (type: string) => void
  onCreateNewType?: () => void
  onCustomizeType?: (typeName: string, icon: string, color: string) => void
  onReorderSections?: (orderedTypes: { typeName: string; order: number }[]) => void
  modifiedCount?: number
  onCommitPush?: () => void
}

const TOP_NAV = [
  { label: 'All Notes', filter: 'all' as const, Icon: FileText },
  { label: 'Favorites', filter: 'favorites' as const, Icon: Star },
]

interface SectionGroup {
  label: string
  type: string
  Icon: ComponentType<IconProps>
  customColor?: string | null
}

const BUILT_IN_SECTION_GROUPS: SectionGroup[] = [
  { label: 'Projects', type: 'Project', Icon: Wrench },
  { label: 'Experiments', type: 'Experiment', Icon: Flask },
  { label: 'Responsibilities', type: 'Responsibility', Icon: Target },
  { label: 'Procedures', type: 'Procedure', Icon: ArrowsClockwise },
  { label: 'People', type: 'Person', Icon: Users },
  { label: 'Events', type: 'Event', Icon: CalendarBlank },
  { label: 'Topics', type: 'Topic', Icon: Tag },
  { label: 'Types', type: 'Type', Icon: StackSimple },
]

const BUILT_IN_TYPES = new Set(BUILT_IN_SECTION_GROUPS.map((s) => s.type))

export const Sidebar = memo(function Sidebar({ entries, selection, onSelect, onSelectNote, onCreateType, onCreateNewType, onCustomizeType, onReorderSections, modifiedCount = 0, onCommitPush }: SidebarProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [customizeTarget, setCustomizeTarget] = useState<string | null>(null)
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null)
  const [contextMenuType, setContextMenuType] = useState<string | null>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [showCustomize, setShowCustomize] = useState(false)
  const customizeRef = useRef<HTMLDivElement>(null)
  const { toggleSection: toggleVisibility, isSectionVisible } = useSectionVisibility()

  // Close section-visibility popover on outside click
  useEffect(() => {
    if (!showCustomize) return
    const handleClick = (e: MouseEvent) => {
      if (customizeRef.current && !customizeRef.current.contains(e.target as Node)) {
        setShowCustomize(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showCustomize])

  const toggleSection = (type: string) => {
    setCollapsed((prev) => ({ ...prev, [type]: !(prev[type] ?? true) }))
  }

  // Build a map of type name → type entry for quick lookup of icon/color
  const typeEntryMap = useMemo(() => {
    const map: Record<string, VaultEntry> = {}
    for (const e of entries) {
      if (e.isA === 'Type') map[e.title] = e
    }
    return map
  }, [entries])

  const isActive = (sel: SidebarSelection): boolean => {
    if (selection.kind !== sel.kind) return false
    if (sel.kind === 'filter' && selection.kind === 'filter') return sel.filter === selection.filter
    if (sel.kind === 'sectionGroup' && selection.kind === 'sectionGroup') return sel.type === selection.type
    if (sel.kind === 'entity' && selection.kind === 'entity') return sel.entry.path === selection.entry.path
    if (sel.kind === 'topic' && selection.kind === 'topic') return sel.entry.path === selection.entry.path
    return false
  }

  // Derive custom type sections from Type entries not in the built-in list
  const customSectionGroups: SectionGroup[] = useMemo(() => {
    return entries
      .filter((e) => e.isA === 'Type' && !BUILT_IN_TYPES.has(e.title))
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((e) => ({
        label: e.title + 's',
        type: e.title,
        Icon: resolveIcon(e.icon),
        customColor: e.color,
      }))
  }, [entries])

  // For built-in types, check if they have custom icon/color overrides from their type entry
  const builtInWithOverrides: SectionGroup[] = useMemo(() => {
    return BUILT_IN_SECTION_GROUPS.map((sg) => {
      const typeEntry = typeEntryMap[sg.type]
      if (!typeEntry?.icon && !typeEntry?.color) return sg
      return {
        ...sg,
        Icon: typeEntry?.icon ? resolveIcon(typeEntry.icon) : sg.Icon,
        customColor: typeEntry?.color ?? null,
      }
    })
  }, [typeEntryMap])

  // Merge built-in and custom sections, then sort by order from type entries
  const allSectionGroups = useMemo(() => {
    const merged = [...builtInWithOverrides, ...customSectionGroups]
    return merged.sort((a, b) => {
      const orderA = typeEntryMap[a.type]?.order ?? Infinity
      const orderB = typeEntryMap[b.type]?.order ?? Infinity
      if (orderA !== orderB) return orderA - orderB
      return a.label.localeCompare(b.label)
    })
  }, [builtInWithOverrides, customSectionGroups, typeEntryMap])

  // DnD sensors with activation distance to avoid accidental drags on click
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const visibleSections = useMemo(
    () => allSectionGroups.filter((g) => isSectionVisible(g.type)),
    [allSectionGroups, isSectionVisible],
  )

  const sectionIds = useMemo(() => visibleSections.map((g) => g.type), [visibleSections])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = sectionIds.indexOf(active.id as string)
    const newIndex = sectionIds.indexOf(over.id as string)
    if (oldIndex === -1 || newIndex === -1) return

    // Compute new order: assign sequential order values to the reordered list
    const reordered = [...sectionIds]
    reordered.splice(oldIndex, 1)
    reordered.splice(newIndex, 0, active.id as string)

    const updates = reordered.map((typeName, i) => ({ typeName, order: i }))
    onReorderSections?.(updates)
  }, [sectionIds, onReorderSections])

  const archivedCount = useMemo(() => entries.filter((e) => e.archived).length, [entries])

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenuPos) return
    const handler = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenuPos(null)
        setContextMenuType(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [contextMenuPos])

  // Close customize popover on outside click
  useEffect(() => {
    if (!customizeTarget) return
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setCustomizeTarget(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [customizeTarget])

  const handleContextMenu = useCallback((e: React.MouseEvent, type: string) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenuPos({ x: e.clientX, y: e.clientY })
    setContextMenuType(type)
  }, [])

  const openCustomizePopover = useCallback((type: string) => {
    setContextMenuPos(null)
    setContextMenuType(null)
    setCustomizeTarget(type)
  }, [])

  const handleCustomizeIcon = useCallback((icon: string) => {
    if (!customizeTarget) return
    const typeEntry = typeEntryMap[customizeTarget]
    if (typeEntry && onCustomizeType) {
      onCustomizeType(customizeTarget, icon, typeEntry.color ?? 'blue')
    }
  }, [customizeTarget, typeEntryMap, onCustomizeType])

  const handleCustomizeColor = useCallback((color: string) => {
    if (!customizeTarget) return
    const typeEntry = typeEntryMap[customizeTarget]
    if (typeEntry && onCustomizeType) {
      onCustomizeType(customizeTarget, typeEntry.icon ?? 'file-text', color)
    }
  }, [customizeTarget, typeEntryMap, onCustomizeType])

  const renderSectionContent = ({ label, type, Icon, customColor }: SectionGroup, dragHandleProps?: Record<string, unknown>) => {
    const items = entries.filter((e) => e.isA === type && !e.archived)
    const isCollapsed = collapsed[type] ?? true
    const isTopic = type === 'Topic'
    const isTypeSection = type === 'Type'
    const sectionColor = getTypeColor(type, customColor)
    const sectionLightColor = getTypeLightColor(type, customColor)

    const handlePlusClick = (e: React.MouseEvent) => {
      e.stopPropagation()
      if (isTypeSection) {
        onCreateNewType?.()
      } else {
        onCreateType?.(type)
      }
    }

    return (
      <>
        {/* Section header row */}
        <div
          className={cn(
            "group/section flex cursor-pointer select-none items-center justify-between rounded transition-colors",
            isActive({ kind: 'sectionGroup', type })
              ? "bg-secondary"
              : "hover:bg-accent"
          )}
          style={{ padding: '6px 8px 6px 6px', borderRadius: 4, gap: 4 }}
          onClick={() => onSelect({ kind: 'sectionGroup', type })}
          onContextMenu={(e) => handleContextMenu(e, type)}
        >
          <div className="flex items-center" style={{ gap: 4 }}>
            {/* Drag handle */}
            <div
              className="flex shrink-0 items-center justify-center text-muted-foreground opacity-0 group-hover/section:opacity-50 hover:!opacity-100 cursor-grab"
              style={{ width: 16, height: 16 }}
              {...dragHandleProps}
              aria-label={`Drag to reorder ${label}`}
            >
              <GripVertical size={12} />
            </div>
            <Icon size={16} style={{ color: sectionColor }} />
            <span className="text-[13px] font-medium text-foreground" style={{ marginLeft: 4 }}>{label}</span>
          </div>
          <div className="flex items-center" style={{ gap: 2 }}>
            {(onCreateType || (isTypeSection && onCreateNewType)) && (
              <button
                className="flex shrink-0 items-center justify-center rounded border-none bg-transparent p-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/section:opacity-100 cursor-pointer"
                style={{ width: 20, height: 20 }}
                onClick={handlePlusClick}
                aria-label={isTypeSection ? 'Create new Type' : `Create new ${type}`}
                title={isTypeSection ? 'New Type' : `New ${type}`}
              >
                <Plus size={14} />
              </button>
            )}
            <button
              className="flex shrink-0 items-center border-none bg-transparent p-0 text-inherit cursor-pointer"
              onClick={(e) => {
                e.stopPropagation()
                toggleSection(type)
              }}
              aria-label={isCollapsed ? `Expand ${label}` : `Collapse ${label}`}
            >
              {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>
        </div>

        {/* Children items */}
        {!isCollapsed && items.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {items.map((entry) => (
              <div
                key={entry.path}
                className={cn(
                  "cursor-pointer truncate rounded-md text-[13px] font-normal transition-colors",
                  isActive(isTopic ? { kind: 'topic', entry } : { kind: 'entity', entry })
                    ? "text-foreground"
                    : "text-muted-foreground hover:bg-accent"
                )}
                style={{
                  padding: '4px 16px 4px 28px',
                  ...(isActive(isTopic ? { kind: 'topic', entry } : { kind: 'entity', entry }) && {
                    backgroundColor: sectionLightColor,
                    color: sectionColor,
                  }),
                }}
                onClick={() => {
                  onSelect(isTopic ? { kind: 'topic', entry } : { kind: 'entity', entry })
                  onSelectNote?.(entry)
                }}
              >
                {entry.title}
              </div>
            ))}
          </div>
        )}
      </>
    )
  }

  function SortableSection({ group }: { group: SectionGroup }) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: group.type })

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
      padding: '4px 6px',
    }

    return (
      <div ref={setNodeRef} style={style} {...attributes}>
        {renderSectionContent(group, listeners)}
      </div>
    )
  }

  return (
    <aside className="flex h-full flex-col overflow-hidden border-r border-[var(--sidebar-border)] bg-sidebar text-sidebar-foreground" style={{ paddingTop: 38 } as React.CSSProperties}>
      {/* Native macOS title bar on top */}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto">
        {/* Top nav — All Notes + Favorites */}
        <div className="border-b border-border" style={{ padding: '4px 6px' }}>
          {TOP_NAV.map(({ label, filter, Icon }) => {
            const count = filter === 'all' ? entries.filter((e) => !e.archived).length : 0
            return (
              <div
                key={filter}
                className={cn(
                  "flex cursor-pointer select-none items-center gap-2 rounded transition-colors",
                  isActive({ kind: 'filter', filter })
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-accent"
                )}
                style={{ padding: '6px 16px', borderRadius: 4 }}
                onClick={() => onSelect({ kind: 'filter', filter })}
              >
                <Icon size={16} />
                <span className="flex-1 text-[13px] font-medium">{label}</span>
                {count > 0 && (
                  <span
                    className="flex items-center justify-center bg-primary text-primary-foreground"
                    style={{ height: 20, borderRadius: 9999, padding: '0 6px', fontSize: 10 }}
                  >
                    {count}
                  </span>
                )}
              </div>
            )
          })}
          {/* Archive filter */}
          <div
            className={cn(
              "flex cursor-pointer select-none items-center gap-2 rounded transition-colors",
              isActive({ kind: 'filter', filter: 'archived' })
                ? "bg-primary/10 text-primary"
                : "text-foreground hover:bg-accent"
            )}
            style={{ padding: '6px 16px', borderRadius: 4 }}
            onClick={() => onSelect({ kind: 'filter', filter: 'archived' })}
          >
            <Archive size={16} />
            <span className="flex-1 text-[13px] font-medium">Archive</span>
            {archivedCount > 0 && (
              <span
                className="flex items-center justify-center text-muted-foreground"
                style={{ height: 20, borderRadius: 9999, padding: '0 6px', fontSize: 10, background: 'var(--muted)' }}
              >
                {archivedCount}
              </span>
            )}
          </div>
          {/* Disabled placeholders */}
          <div
            className="flex select-none items-center gap-2 rounded text-foreground"
            style={{ padding: '6px 16px', borderRadius: 4, opacity: 0.4, cursor: 'not-allowed' }}
            title="Coming soon"
          >
            <TagSimple size={16} />
            <span className="flex-1 text-[13px] font-medium">Untagged</span>
          </div>
          <div
            className="flex select-none items-center gap-2 rounded text-foreground"
            style={{ padding: '6px 16px', borderRadius: 4, opacity: 0.4, cursor: 'not-allowed' }}
            title="Coming soon"
          >
            <Trash size={16} />
            <span className="flex-1 text-[13px] font-medium">Trash</span>
          </div>
        </div>

        {/* Customize sections button + popover */}
        <div ref={customizeRef} style={{ position: 'relative', padding: '4px 6px 0' }}>
          <button
            className="flex w-full cursor-pointer select-none items-center rounded border-none bg-transparent text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            style={{ padding: '4px 16px', gap: 6 }}
            onClick={() => setShowCustomize((v) => !v)}
            aria-label="Customize sections"
            title="Customize sections"
          >
            <SlidersHorizontal size={14} />
            <span className="text-[12px]">Customize sections</span>
          </button>

          {showCustomize && (
            <div
              className="border border-border bg-popover text-popover-foreground"
              style={{
                position: 'absolute',
                top: '100%',
                left: 6,
                right: 6,
                zIndex: 50,
                borderRadius: 8,
                padding: '8px 0',
                boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
              }}
            >
              <div className="text-[12px] font-semibold text-muted-foreground" style={{ padding: '0 12px 4px' }}>
                Show in sidebar
              </div>
              {allSectionGroups.map(({ label, type, Icon }) => (
                <button
                  key={type}
                  className="flex w-full cursor-pointer items-center border-none bg-transparent transition-colors hover:bg-accent"
                  style={{ padding: '6px 12px', gap: 8 }}
                  onClick={() => toggleVisibility(type)}
                  aria-label={`Toggle ${label}`}
                >
                  <Icon size={14} style={{ color: getTypeColor(type) }} />
                  <span className="flex-1 text-left text-[13px] text-foreground">{label}</span>
                  <div
                    className="flex items-center"
                    style={{
                      width: 32,
                      height: 18,
                      borderRadius: 9,
                      padding: 2,
                      backgroundColor: isSectionVisible(type) ? 'var(--primary)' : 'var(--muted)',
                      justifyContent: isSectionVisible(type) ? 'flex-end' : 'flex-start',
                      transition: 'background-color 150ms',
                    }}
                  >
                    <div
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 7,
                        backgroundColor: 'white',
                        transition: 'transform 150ms',
                      }}
                    />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Section Groups (built-in + custom), filtered by visibility, sortable by drag */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
            {visibleSections.map((g) => (
              <SortableSection key={g.type} group={g} />
            ))}
          </SortableContext>
        </DndContext>
      </nav>

      {/* Commit button — always visible */}
      {onCommitPush && (
        <div className="shrink-0 border-t border-border" style={{ padding: 12 }}>
          <button
            className="flex w-full items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            style={{ borderRadius: 6, gap: 6, padding: '8px 16px', border: 'none', cursor: 'pointer' }}
            onClick={onCommitPush}
          >
            <GitCommitHorizontal size={14} />
            <span className="text-[13px] font-medium">Commit & Push</span>
            {modifiedCount > 0 && (
              <span
                className="text-white font-semibold"
                style={{ background: '#ffffff40', borderRadius: 9, padding: '0 6px', fontSize: 10 }}
              >
                {modifiedCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Context menu (right-click on section header) */}
      {contextMenuPos && contextMenuType && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 rounded-md border bg-popover p-1 shadow-md"
          style={{ left: contextMenuPos.x, top: contextMenuPos.y, minWidth: 180 }}
        >
          <button
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-default hover:bg-accent hover:text-accent-foreground transition-colors border-none bg-transparent text-left"
            onClick={() => openCustomizePopover(contextMenuType)}
          >
            Customize icon & color…
          </button>
        </div>
      )}

      {/* Customize popover */}
      {customizeTarget && (
        <div
          ref={popoverRef}
          className="fixed z-50"
          style={{ left: 20, top: 100 }}
        >
          <TypeCustomizePopover
            currentIcon={typeEntryMap[customizeTarget]?.icon ?? null}
            currentColor={typeEntryMap[customizeTarget]?.color ?? null}
            onChangeIcon={handleCustomizeIcon}
            onChangeColor={handleCustomizeColor}
            onClose={() => setCustomizeTarget(null)}
          />
        </div>
      )}
    </aside>
  )
})
