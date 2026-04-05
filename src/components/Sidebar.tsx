import { useState, useMemo, useRef, useEffect, useCallback, memo } from 'react'
import type { VaultEntry, FolderNode, SidebarSelection, ViewFile } from '../types'
import { buildTypeEntryMap } from '../utils/typeColors'
import { buildDynamicSections, sortSections } from '../utils/sidebarSections'
import { TypeCustomizePopover } from './TypeCustomizePopover'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  FileText, Trash, Archive, CaretLeft, Tray, CaretRight, CaretDown, Plus, Funnel, PencilSimple,
} from '@phosphor-icons/react'
import { isEmoji } from '../utils/emoji'
import { arrayMove } from '@dnd-kit/sortable'
import { SlidersHorizontal } from 'lucide-react'
import {
  type SectionGroup, isSelectionActive,
  NavItem, SectionContent, type SectionContentProps, VisibilityPopover,
} from './SidebarParts'
import { useDragRegion } from '../hooks/useDragRegion'
import { FolderTree } from './FolderTree'

interface SidebarProps {
  entries: VaultEntry[]
  selection: SidebarSelection
  onSelect: (selection: SidebarSelection) => void
  onSelectNote?: (entry: VaultEntry) => void
  onCreateType?: (type: string) => void
  onCreateNewType?: () => void
  onCustomizeType?: (typeName: string, icon: string, color: string) => void
  onUpdateTypeTemplate?: (typeName: string, template: string) => void
  onReorderSections?: (orderedTypes: { typeName: string; order: number }[]) => void
  onRenameSection?: (typeName: string, label: string) => void
  onToggleTypeVisibility?: (typeName: string) => void
  onSelectFavorite?: (entry: VaultEntry) => void
  onReorderFavorites?: (orderedPaths: string[]) => void
  views?: ViewFile[]
  onCreateView?: () => void
  onEditView?: (filename: string) => void
  onDeleteView?: (filename: string) => void
  folders?: FolderNode[]
  onCreateFolder?: (name: string) => void
  inboxCount?: number
  onCollapse?: () => void
}

// --- Hooks ---

function useOutsideClick(ref: React.RefObject<HTMLElement | null>, isOpen: boolean, onClose: () => void) {
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [ref, isOpen, onClose])
}

function useSidebarSections(entries: VaultEntry[]) {
  const typeEntryMap = useMemo(() => buildTypeEntryMap(entries), [entries])
  const allSectionGroups = useMemo(() => {
    const sections = buildDynamicSections(entries, typeEntryMap)
    return sortSections(sections, typeEntryMap)
  }, [entries, typeEntryMap])
  const visibleSections = useMemo(() => allSectionGroups.filter((g) => typeEntryMap[g.type]?.visible !== false), [allSectionGroups, typeEntryMap])
  const sectionIds = useMemo(() => visibleSections.map((g) => g.type), [visibleSections])
  return { typeEntryMap, allSectionGroups, visibleSections, sectionIds }
}

const SIDEBAR_COLLAPSED_KEY = 'laputa:sidebar-collapsed'

type SidebarGroupKey = 'favorites' | 'views' | 'sections' | 'folders'

function loadCollapsedState(): Record<SidebarGroupKey, boolean> {
  try {
    const raw = localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return { favorites: false, views: false, sections: false, folders: false }
}

function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState<Record<SidebarGroupKey, boolean>>(loadCollapsedState)

  const toggle = useCallback((key: SidebarGroupKey) => {
    setCollapsed((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return { collapsed, toggle }
}

function useEntryCounts(entries: VaultEntry[]) {
  return useMemo(() => {
    let active = 0, archived = 0, trashed = 0
    for (const e of entries) {
      if (e.trashed) trashed++
      else if (e.archived) archived++
      else active++
    }
    return { activeCount: active, archivedCount: archived, trashedCount: trashed }
  }, [entries])
}

function computeReorder(sectionIds: string[], activeId: string, overId: string): string[] | null {
  const oldIndex = sectionIds.indexOf(activeId)
  const newIndex = sectionIds.indexOf(overId)
  if (oldIndex === -1 || newIndex === -1) return null
  const reordered = [...sectionIds]
  reordered.splice(oldIndex, 1)
  reordered.splice(newIndex, 0, activeId)
  return reordered
}

function buildCustomizeArgs(typeEntry: VaultEntry, prop: 'icon' | 'color', value: string): [string, string] {
  return [
    prop === 'icon' ? value : (typeEntry.icon ?? 'file-text'),
    prop === 'color' ? value : (typeEntry.color ?? 'blue'),
  ]
}

function applyCustomization(
  target: string | null,
  typeEntryMap: Record<string, VaultEntry>,
  onCustomizeType: ((typeName: string, icon: string, color: string) => void) | undefined,
  prop: 'icon' | 'color',
  value: string,
): void {
  if (!target || !onCustomizeType) return
  const te = typeEntryMap[target]
  const [icon, color] = te
    ? buildCustomizeArgs(te, prop, value)
    : [prop === 'icon' ? value : 'file-text', prop === 'color' ? value : 'blue']
  onCustomizeType(target, icon, color)
}

// --- Sub-components ---

function SidebarGroupHeader({ label, collapsed, onToggle, count, children }: {
  label: string
  collapsed: boolean
  onToggle: () => void
  count?: number
  children?: React.ReactNode
}) {
  return (
    <button
      className="flex w-full cursor-pointer select-none items-center justify-between border-none bg-transparent text-muted-foreground"
      style={{ padding: '8px 14px 8px 16px' }}
      onClick={onToggle}
    >
      <div className="flex items-center gap-1">
        {collapsed ? <CaretRight size={12} /> : <CaretDown size={12} />}
        <span className="text-[10px] font-semibold" style={{ letterSpacing: 0.5 }}>{label}</span>
      </div>
      {children ?? (count != null && (
        <span className="flex items-center justify-center text-muted-foreground" style={{ height: 18, borderRadius: 9999, padding: '0 5px', fontSize: 10, background: 'var(--muted)' }}>
          {count}
        </span>
      ))}
    </button>
  )
}

function ViewItem({ view, isActive, onSelect, onEditView, onDeleteView }: {
  view: ViewFile
  isActive: boolean
  onSelect: () => void
  onEditView?: (filename: string) => void
  onDeleteView?: (filename: string) => void
}) {
  return (
    <div className="group relative">
      <NavItem
        icon={Funnel}
        emoji={view.definition.icon}
        label={view.definition.name}
        isActive={isActive}
        onClick={onSelect}
      />
      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        {onEditView && (
          <button
            className="rounded p-0.5 text-muted-foreground hover:text-foreground"
            onClick={(e) => { e.stopPropagation(); onEditView(view.filename) }}
            title="Edit view"
          >
            <PencilSimple size={12} />
          </button>
        )}
        {onDeleteView && (
          <button
            className="rounded p-0.5 text-muted-foreground hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); onDeleteView(view.filename) }}
            title="Delete view"
          >
            <Trash size={12} />
          </button>
        )}
      </div>
    </div>
  )
}

function ViewsSection({ views, selection, onSelect, collapsed, onToggle, onCreateView, onEditView, onDeleteView }: {
  views: ViewFile[]
  selection: SidebarSelection
  onSelect: (sel: SidebarSelection) => void
  collapsed: boolean
  onToggle: () => void
  onCreateView?: () => void
  onEditView?: (filename: string) => void
  onDeleteView?: (filename: string) => void
}) {
  return (
    <div className="border-b border-border" style={{ padding: '0 6px' }}>
      <SidebarGroupHeader label="VIEWS" collapsed={collapsed} onToggle={onToggle}>
        {onCreateView && (
          <Plus
            size={12}
            className="text-muted-foreground hover:text-foreground"
            onClick={(e) => { e.stopPropagation(); onCreateView() }}
          />
        )}
      </SidebarGroupHeader>
      {!collapsed && (
        <div style={{ paddingBottom: 4 }}>
          {views.map((v) => (
            <ViewItem
              key={v.filename}
              view={v}
              isActive={isSelectionActive(selection, { kind: 'view', filename: v.filename })}
              onSelect={() => onSelect({ kind: 'view', filename: v.filename })}
              onEditView={onEditView}
              onDeleteView={onDeleteView}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function TypesSection({ visibleSections, allSectionGroups, sectionIds, sensors, handleDragEnd, sectionProps, collapsed, onToggle, showCustomize, setShowCustomize, isSectionVisible, toggleVisibility, onCreateNewType, customizeRef }: {
  visibleSections: SectionGroup[]
  allSectionGroups: SectionGroup[]
  sectionIds: string[]
  sensors: ReturnType<typeof useSensors>
  handleDragEnd: (event: DragEndEvent) => void
  sectionProps: {
    entries: VaultEntry[]; selection: SidebarSelection; onSelect: (sel: SidebarSelection) => void
    onContextMenu: (e: React.MouseEvent, type: string) => void
    renamingType: string | null; renameInitialValue: string; onRenameSubmit: (v: string) => void; onRenameCancel: () => void
  }
  collapsed: boolean
  onToggle: () => void
  showCustomize: boolean
  setShowCustomize: React.Dispatch<React.SetStateAction<boolean>>
  isSectionVisible: (type: string) => boolean
  toggleVisibility: (type: string) => void
  onCreateNewType?: () => void
  customizeRef: React.RefObject<HTMLDivElement | null>
}) {
  return (
    <div className="border-b border-border">
      <div ref={customizeRef} style={{ position: 'relative', padding: '0 6px' }}>
        <SidebarGroupHeader label="TYPES" collapsed={collapsed} onToggle={onToggle}>
          <div className="flex items-center gap-1.5">
            <span
              role="button"
              title="Customize sections"
              aria-label="Customize sections"
              onClick={(e) => { e.stopPropagation(); setShowCustomize((v) => !v) }}
            >
              <SlidersHorizontal size={12} className="text-muted-foreground hover:text-foreground" />
            </span>
            {onCreateNewType && (
              <Plus
                size={12}
                className="text-muted-foreground hover:text-foreground"
                data-testid="create-type-btn"
                onClick={(e) => { e.stopPropagation(); onCreateNewType() }}
              />
            )}
          </div>
        </SidebarGroupHeader>
        {showCustomize && <VisibilityPopover sections={allSectionGroups} isSectionVisible={isSectionVisible} onToggle={toggleVisibility} />}
      </div>
      {!collapsed && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
            {visibleSections.map((g) => (
              <SortableSection key={g.type} group={g} sectionProps={sectionProps} />
            ))}
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}

function SortableSection({ group, sectionProps }: {
  group: SectionGroup
  sectionProps: Omit<SectionContentProps, 'group' | 'itemCount' | 'isRenaming' | 'renameInitialValue'>
    & { entries: VaultEntry[]; renamingType: string | null; renameInitialValue: string }
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: group.type })
  const itemCount = sectionProps.entries.filter((e) =>
    !e.archived && !e.trashed && (group.type === 'Note' ? (e.isA === 'Note' || !e.isA) : e.isA === group.type),
  ).length
  const isRenaming = sectionProps.renamingType === group.type

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, padding: '0 6px' }} {...attributes}>
      <SectionContent
        group={group} itemCount={itemCount}
        selection={sectionProps.selection} onSelect={sectionProps.onSelect}
        onContextMenu={sectionProps.onContextMenu}
        dragHandleProps={listeners}
        isRenaming={isRenaming}
        renameInitialValue={isRenaming ? sectionProps.renameInitialValue : undefined}
        onRenameSubmit={sectionProps.onRenameSubmit}
        onRenameCancel={sectionProps.onRenameCancel}
      />
    </div>
  )
}

function SortableFavoriteItem({ entry, isActive, onSelect }: {
  entry: VaultEntry; isActive: boolean; onSelect: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entry.path })
  const icon = entry.icon && isEmoji(entry.icon) ? entry.icon : null
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }} {...attributes} {...listeners}>
      <div
        className={`flex cursor-pointer select-none items-center gap-1.5 rounded text-[13px] font-normal transition-colors ${isActive ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-accent'}`}
        style={{ padding: '4px 16px 4px 28px' }}
        onClick={onSelect}
      >
        {icon && <span className="shrink-0">{icon}</span>}
        <span className="truncate">{entry.title}</span>
      </div>
    </div>
  )
}

function FavoritesSection({ entries, selection, onSelect, onSelectNote, onReorder, collapsed, onToggle }: {
  entries: VaultEntry[]
  selection: SidebarSelection
  onSelect: (sel: SidebarSelection) => void
  onSelectNote?: (entry: VaultEntry) => void
  onReorder?: (orderedPaths: string[]) => void
  collapsed: boolean
  onToggle: () => void
}) {
  const favorites = useMemo(
    () => entries
      .filter((e) => e.favorite && !e.archived && !e.trashed)
      .sort((a, b) => (a.favoriteIndex ?? Infinity) - (b.favoriteIndex ?? Infinity)),
    [entries],
  )
  const favIds = useMemo(() => favorites.map((f) => f.path), [favorites])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = favIds.indexOf(active.id as string)
    const newIndex = favIds.indexOf(over.id as string)
    if (oldIndex === -1 || newIndex === -1) return
    const reordered = arrayMove(favIds, oldIndex, newIndex)
    onReorder?.(reordered)
  }, [favIds, onReorder])

  if (favorites.length === 0) return null

  return (
    <div style={{ padding: '0 6px' }}>
      <SidebarGroupHeader label="FAVORITES" collapsed={collapsed} onToggle={onToggle} count={favorites.length} />
      {!collapsed && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={favIds} strategy={verticalListSortingStrategy}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingBottom: 4 }}>
              {favorites.map((entry) => {
                const isActive = isSelectionActive(selection, { kind: 'entity', entry })
                return (
                  <SortableFavoriteItem
                    key={entry.path}
                    entry={entry}
                    isActive={isActive}
                    onSelect={() => {
                      onSelect({ kind: 'filter', filter: 'favorites' })
                      onSelectNote?.(entry)
                    }}
                  />
                )
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}

function SidebarTitleBar({ onCollapse }: { onCollapse?: () => void }) {
  const { onMouseDown } = useDragRegion()
  return (
    <div className="shrink-0 flex items-center justify-end border-b border-border" style={{ height: 52, padding: '0 8px', paddingLeft: 80, cursor: 'default' } as React.CSSProperties} onMouseDown={onMouseDown}>
      {onCollapse && (
        <button
          className="flex shrink-0 cursor-pointer items-center justify-center rounded border-none bg-transparent p-0 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          style={{ width: 24, height: 24 }}
          onClick={onCollapse}
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
        >
          <CaretLeft size={14} weight="bold" />
        </button>
      )}
    </div>
  )
}

function ContextMenuOverlay({ pos, type, innerRef, onOpenCustomize, onStartRename }: {
  pos: { x: number; y: number } | null; type: string | null
  innerRef: React.Ref<HTMLDivElement>
  onOpenCustomize: (type: string) => void
  onStartRename: (type: string) => void
}) {
  if (!pos || !type) return null
  const btnClass = "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-default hover:bg-accent hover:text-accent-foreground transition-colors border-none bg-transparent text-left"
  return (
    <div ref={innerRef} className="fixed z-50 rounded-md border bg-popover p-1 shadow-md" style={{ left: pos.x, top: pos.y, minWidth: 180 }}>
      <button className={btnClass} onClick={() => onStartRename(type)}>
        Rename section…
      </button>
      <button className={btnClass} onClick={() => onOpenCustomize(type)}>
        Customize icon &amp; color…
      </button>
    </div>
  )
}

function CustomizeOverlay({ target, typeEntryMap, innerRef, onCustomize, onChangeTemplate, onClose }: {
  target: string | null; typeEntryMap: Record<string, VaultEntry>
  innerRef: React.Ref<HTMLDivElement>
  onCustomize: (prop: 'icon' | 'color', value: string) => void
  onChangeTemplate: (template: string) => void
  onClose: () => void
}) {
  if (!target) return null
  return (
    <div ref={innerRef} className="fixed z-50" style={{ left: 20, top: 100 }}>
      <TypeCustomizePopover
        currentIcon={typeEntryMap[target]?.icon ?? null}
        currentColor={typeEntryMap[target]?.color ?? null}
        currentTemplate={typeEntryMap[target]?.template ?? null}
        onChangeIcon={(icon) => onCustomize('icon', icon)}
        onChangeColor={(color) => onCustomize('color', color)}
        onChangeTemplate={onChangeTemplate}
        onClose={onClose}
      />
    </div>
  )
}

// --- Main Sidebar ---

export const Sidebar = memo(function Sidebar({
  entries, selection, onSelect,
  onCustomizeType, onUpdateTypeTemplate, onReorderSections, onRenameSection,
  onToggleTypeVisibility, onSelectFavorite, onReorderFavorites,
  views = [], onCreateView, onEditView, onDeleteView,
  folders = [], onCreateFolder, inboxCount = 0, onCollapse,
  onCreateNewType,
}: SidebarProps) {
  const [customizeTarget, setCustomizeTarget] = useState<string | null>(null)
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null)
  const [renamingType, setRenamingType] = useState<string | null>(null)
  const [renameInitialValue, setRenameInitialValue] = useState('')
  const [contextMenuType, setContextMenuType] = useState<string | null>(null)
  const [showCustomize, setShowCustomize] = useState(false)

  const contextMenuRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const customizeRef = useRef<HTMLDivElement>(null)

  const { typeEntryMap, allSectionGroups, visibleSections, sectionIds } = useSidebarSections(entries)

  const isSectionVisible = useCallback((type: string) => typeEntryMap[type]?.visible !== false, [typeEntryMap])
  const toggleVisibility = useCallback((type: string) => onToggleTypeVisibility?.(type), [onToggleTypeVisibility])
  const { activeCount, archivedCount, trashedCount } = useEntryCounts(entries)

  const closeContextMenu = useCallback(() => { setContextMenuPos(null); setContextMenuType(null) }, [])
  const closeCustomize = useCallback(() => setShowCustomize(false), [])
  const closeCustomizeTarget = useCallback(() => setCustomizeTarget(null), [])

  useOutsideClick(customizeRef, showCustomize, closeCustomize)
  useOutsideClick(contextMenuRef, !!contextMenuPos, closeContextMenu)
  useOutsideClick(popoverRef, !!customizeTarget, closeCustomizeTarget)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const reordered = computeReorder(sectionIds, active.id as string, over.id as string)
    if (reordered) onReorderSections?.(reordered.map((typeName, i) => ({ typeName, order: i })))
  }, [sectionIds, onReorderSections])

  const handleContextMenu = useCallback((e: React.MouseEvent, type: string) => {
    e.preventDefault(); e.stopPropagation()
    setContextMenuPos({ x: e.clientX, y: e.clientY }); setContextMenuType(type)
  }, [])

  const cancelRename = useCallback(() => setRenamingType(null), [])

  const handleStartRename = useCallback((type: string) => {
    closeContextMenu()
    const group = allSectionGroups.find((g) => g.type === type)
    setRenameInitialValue(group?.label ?? type)
    setRenamingType(type)
  }, [closeContextMenu, allSectionGroups])

  const handleRenameSubmit = useCallback((value: string) => {
    if (renamingType) onRenameSection?.(renamingType, value)
    setRenamingType(null)
  }, [renamingType, onRenameSection])

  const handleCustomize = useCallback((prop: 'icon' | 'color', value: string) => {
    applyCustomization(customizeTarget, typeEntryMap, onCustomizeType, prop, value)
  }, [customizeTarget, typeEntryMap, onCustomizeType])

  const handleChangeTemplate = useCallback((template: string) => {
    if (customizeTarget) onUpdateTypeTemplate?.(customizeTarget, template)
  }, [customizeTarget, onUpdateTypeTemplate])

  const sectionProps = {
    entries, selection, onSelect,
    onContextMenu: handleContextMenu,
    renamingType, renameInitialValue, onRenameSubmit: handleRenameSubmit, onRenameCancel: cancelRename,
  }

  const { collapsed: groupCollapsed, toggle: toggleGroup } = useSidebarCollapsed()

  const hasFavorites = entries.some((e) => e.favorite && !e.archived && !e.trashed)
  const hasViews = views.length > 0 || !!onCreateView

  return (
    <aside className="flex h-full flex-col overflow-hidden border-r border-[var(--sidebar-border)] bg-sidebar text-sidebar-foreground">
      <SidebarTitleBar onCollapse={onCollapse} />
      <nav className="flex-1 overflow-y-auto">
        {/* Top nav */}
        <div className="border-b border-border" data-testid="sidebar-top-nav" style={{ padding: '4px 6px' }}>
          <NavItem icon={Tray} label="Inbox" count={inboxCount} isActive={isSelectionActive(selection, { kind: 'filter', filter: 'inbox' })} badgeClassName="text-muted-foreground" badgeStyle={{ background: 'var(--muted)' }} activeBadgeClassName="bg-primary text-primary-foreground" onClick={() => onSelect({ kind: 'filter', filter: 'inbox' })} />
          <NavItem icon={FileText} label="All Notes" count={activeCount} isActive={isSelectionActive(selection, { kind: 'filter', filter: 'all' })} badgeClassName="text-muted-foreground" badgeStyle={{ background: 'var(--muted)' }} activeBadgeClassName="bg-primary text-primary-foreground" onClick={() => onSelect({ kind: 'filter', filter: 'all' })} />
          <NavItem icon={Archive} label="Archive" count={archivedCount} isActive={isSelectionActive(selection, { kind: 'filter', filter: 'archived' })} badgeClassName="text-muted-foreground" badgeStyle={{ background: 'var(--muted)' }} activeBadgeClassName="bg-primary text-primary-foreground" onClick={() => onSelect({ kind: 'filter', filter: 'archived' })} />
          <NavItem icon={Trash} label="Trash" count={trashedCount} isActive={isSelectionActive(selection, { kind: 'filter', filter: 'trash' })} activeClassName="bg-destructive/10 text-destructive" badgeClassName="text-muted-foreground" badgeStyle={{ background: 'var(--muted)' }} activeBadgeClassName="bg-destructive text-destructive-foreground" onClick={() => onSelect({ kind: 'filter', filter: 'trash' })} />
        </div>

        {/* Favorites */}
        {hasFavorites && (
          <div className="border-b border-border">
            <FavoritesSection entries={entries} selection={selection} onSelect={onSelect} onSelectNote={onSelectFavorite} onReorder={onReorderFavorites} collapsed={groupCollapsed.favorites} onToggle={() => toggleGroup('favorites')} />
          </div>
        )}

        {/* Views */}
        {hasViews && (
          <ViewsSection views={views} selection={selection} onSelect={onSelect} collapsed={groupCollapsed.views} onToggle={() => toggleGroup('views')} onCreateView={onCreateView} onEditView={onEditView} onDeleteView={onDeleteView} />
        )}

        {/* Types */}
        <TypesSection visibleSections={visibleSections} allSectionGroups={allSectionGroups} sectionIds={sectionIds} sensors={sensors} handleDragEnd={handleDragEnd} sectionProps={sectionProps} collapsed={groupCollapsed.sections} onToggle={() => toggleGroup('sections')} showCustomize={showCustomize} setShowCustomize={setShowCustomize} isSectionVisible={isSectionVisible} toggleVisibility={toggleVisibility} onCreateNewType={onCreateNewType} customizeRef={customizeRef} />

        {/* Folder tree */}
        <FolderTree folders={folders} selection={selection} onSelect={onSelect} onCreateFolder={onCreateFolder} collapsed={groupCollapsed.folders} onToggle={() => toggleGroup('folders')} />
      </nav>

      <ContextMenuOverlay pos={contextMenuPos} type={contextMenuType} innerRef={contextMenuRef} onOpenCustomize={(type) => { closeContextMenu(); setCustomizeTarget(type) }} onStartRename={handleStartRename} />
      <CustomizeOverlay target={customizeTarget} typeEntryMap={typeEntryMap} innerRef={popoverRef} onCustomize={handleCustomize} onChangeTemplate={handleChangeTemplate} onClose={closeCustomizeTarget} />
    </aside>
  )
})
