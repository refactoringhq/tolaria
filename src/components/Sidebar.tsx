import { useState, useMemo, useRef, useEffect, useCallback, memo } from 'react'
import type { VaultEntry, SidebarSelection } from '../types'
import { resolveIcon } from '../utils/iconRegistry'
import { buildTypeEntryMap } from '../utils/typeColors'
import { pluralizeType } from '../hooks/useCommandRegistry'
import { TypeCustomizePopover } from './TypeCustomizePopover'
import { useSectionVisibility } from '../hooks/useSectionVisibility'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  FileText, Star, Wrench, Flask, Target, ArrowsClockwise,
  Users, CalendarBlank, Tag, TagSimple, Trash, StackSimple, Archive, CaretLeft, GitDiff,
} from '@phosphor-icons/react'
import { GitCommitHorizontal, SlidersHorizontal } from 'lucide-react'
import {
  type SectionGroup, isSelectionActive,
  NavItem, SectionContent, type SectionContentProps, VisibilityPopover,
} from './SidebarParts'
import { useDragRegion } from '../hooks/useDragRegion'

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
  modifiedCount?: number
  onCommitPush?: () => void
  onCollapse?: () => void
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

/** Metadata lookup for well-known types (icon/label only — NOT used to determine which sections to show) */
const BUILT_IN_TYPE_MAP = new Map(BUILT_IN_SECTION_GROUPS.map((sg) => [sg.type, sg]))

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

/** Collect unique isA values from active (non-trashed, non-archived) entries, excluding generic Note */
function collectActiveTypes(entries: VaultEntry[]): Set<string> {
  const types = new Set<string>()
  for (const e of entries) {
    if (e.isA && e.isA !== 'Note' && !e.trashed && !e.archived) types.add(e.isA)
  }
  return types
}

/** Build a single SectionGroup for a type, using built-in metadata or Type entry for icon/label */
function buildSectionGroup(type: string, typeEntryMap: Record<string, VaultEntry>): SectionGroup {
  const builtIn = BUILT_IN_TYPE_MAP.get(type)
  const typeEntry = typeEntryMap[type]
  const customColor = typeEntry?.color ?? null
  const label = typeEntry?.sidebarLabel || (builtIn?.label ?? pluralizeType(type))
  if (builtIn) {
    const Icon = typeEntry?.icon ? resolveIcon(typeEntry.icon) : builtIn.Icon
    return { ...builtIn, label, Icon, customColor }
  }
  return { label, type, Icon: resolveIcon(typeEntry?.icon ?? null), customColor }
}

/** Build sections dynamically from actual vault entries — only types with ≥1 active note appear */
function buildDynamicSections(entries: VaultEntry[], typeEntryMap: Record<string, VaultEntry>): SectionGroup[] {
  const activeTypes = collectActiveTypes(entries)
  return Array.from(activeTypes, (type) => buildSectionGroup(type, typeEntryMap))
}

function sortSections(groups: SectionGroup[], typeEntryMap: Record<string, VaultEntry>): SectionGroup[] {
  return [...groups].sort((a, b) => {
    const orderA = typeEntryMap[a.type]?.order ?? Infinity
    const orderB = typeEntryMap[b.type]?.order ?? Infinity
    return orderA !== orderB ? orderA - orderB : a.label.localeCompare(b.label)
  })
}

function useSidebarSections(entries: VaultEntry[], isSectionVisible: (type: string) => boolean) {
  const typeEntryMap = useMemo(() => buildTypeEntryMap(entries), [entries])
  const allSectionGroups = useMemo(() => {
    const sections = buildDynamicSections(entries, typeEntryMap)
    return sortSections(sections, typeEntryMap)
  }, [entries, typeEntryMap])
  const visibleSections = useMemo(() => allSectionGroups.filter((g) => isSectionVisible(g.type)), [allSectionGroups, isSectionVisible])
  const sectionIds = useMemo(() => visibleSections.map((g) => g.type), [visibleSections])
  return { typeEntryMap, allSectionGroups, visibleSections, sectionIds }
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
  if (!te) return
  const [icon, color] = buildCustomizeArgs(te, prop, value)
  onCustomizeType(target, icon, color)
}

// --- Sub-components ---

function SortableSection({ group, sectionProps }: {
  group: SectionGroup
  sectionProps: Omit<SectionContentProps, 'group' | 'items' | 'isCollapsed' | 'dragHandleProps' | 'onToggle'>
    & { entries: VaultEntry[]; collapsed: Record<string, boolean>; onToggle: (type: string) => void }
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: group.type })
  const items = sectionProps.entries.filter((e) => e.isA === group.type && !e.archived && !e.trashed)
  const isCollapsed = sectionProps.collapsed[group.type] ?? true

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, padding: '4px 6px' }} {...attributes}>
      <SectionContent
        group={group} items={items} isCollapsed={isCollapsed}
        selection={sectionProps.selection} onSelect={sectionProps.onSelect}
        onSelectNote={sectionProps.onSelectNote} onCreateType={sectionProps.onCreateType}
        onCreateNewType={sectionProps.onCreateNewType} onContextMenu={sectionProps.onContextMenu}
        onToggle={() => sectionProps.onToggle(group.type)}
        dragHandleProps={listeners}
      />
    </div>
  )
}

function CommitButton({ modifiedCount, onClick }: { modifiedCount: number; onClick?: () => void }) {
  if (!onClick) return null
  return (
    <div className="shrink-0 border-t border-border" style={{ padding: 12 }}>
      <button className="flex w-full items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 transition-colors" style={{ borderRadius: 6, gap: 6, padding: '8px 16px', border: 'none', cursor: 'pointer' }} onClick={onClick}>
        <GitCommitHorizontal size={14} />
        <span className="text-[13px] font-medium">Commit & Push</span>
        {modifiedCount > 0 && (
          <span className="text-white font-semibold" style={{ background: '#ffffff40', borderRadius: 9, padding: '0 6px', fontSize: 10 }}>{modifiedCount}</span>
        )}
      </button>
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

function ContextMenuOverlay({ pos, type, innerRef, onOpenCustomize }: {
  pos: { x: number; y: number } | null; type: string | null
  innerRef: React.Ref<HTMLDivElement>
  onOpenCustomize: (type: string) => void
}) {
  if (!pos || !type) return null
  return (
    <div ref={innerRef} className="fixed z-50 rounded-md border bg-popover p-1 shadow-md" style={{ left: pos.x, top: pos.y, minWidth: 180 }}>
      <button className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-default hover:bg-accent hover:text-accent-foreground transition-colors border-none bg-transparent text-left" onClick={() => onOpenCustomize(type)}>
        Customize icon & color…
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
  entries, selection, onSelect, onSelectNote, onCreateType, onCreateNewType,
  onCustomizeType, onUpdateTypeTemplate, onReorderSections, modifiedCount = 0, onCommitPush, onCollapse,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [customizeTarget, setCustomizeTarget] = useState<string | null>(null)
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null)
  const [contextMenuType, setContextMenuType] = useState<string | null>(null)
  const [showCustomize, setShowCustomize] = useState(false)

  const contextMenuRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const customizeRef = useRef<HTMLDivElement>(null)

  const { toggleSection: toggleVisibility, isSectionVisible } = useSectionVisibility()
  const { typeEntryMap, allSectionGroups, visibleSections, sectionIds } = useSidebarSections(entries, isSectionVisible)
  const { activeCount, archivedCount, trashedCount } = useEntryCounts(entries)

  const closeContextMenu = useCallback(() => { setContextMenuPos(null); setContextMenuType(null) }, [])
  const closeCustomize = useCallback(() => setShowCustomize(false), [])
  const closeCustomizeTarget = useCallback(() => setCustomizeTarget(null), [])

  useOutsideClick(customizeRef, showCustomize, closeCustomize)
  useOutsideClick(contextMenuRef, !!contextMenuPos, closeContextMenu)
  useOutsideClick(popoverRef, !!customizeTarget, closeCustomizeTarget)

  const toggleSection = useCallback((type: string) => {
    setCollapsed((prev) => ({ ...prev, [type]: !(prev[type] ?? true) }))
  }, [])

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

  const handleCustomize = useCallback((prop: 'icon' | 'color', value: string) => {
    applyCustomization(customizeTarget, typeEntryMap, onCustomizeType, prop, value)
  }, [customizeTarget, typeEntryMap, onCustomizeType])

  const handleChangeTemplate = useCallback((template: string) => {
    if (customizeTarget) onUpdateTypeTemplate?.(customizeTarget, template)
  }, [customizeTarget, onUpdateTypeTemplate])

  const sectionProps = {
    entries, collapsed, selection, onSelect, onSelectNote, onCreateType, onCreateNewType,
    onContextMenu: handleContextMenu, onToggle: toggleSection,
  }

  return (
    <aside className="flex h-full flex-col overflow-hidden border-r border-[var(--sidebar-border)] bg-sidebar text-sidebar-foreground">
      <SidebarTitleBar onCollapse={onCollapse} />
      <nav className="flex-1 overflow-y-auto">
        {/* Top nav */}
        <div className="border-b border-border" style={{ padding: '4px 6px' }}>
          <NavItem icon={FileText} label="All Notes" count={activeCount} isActive={isSelectionActive(selection, { kind: 'filter', filter: 'all' })} badgeClassName="bg-primary text-primary-foreground" onClick={() => onSelect({ kind: 'filter', filter: 'all' })} />
          <NavItem icon={Star} label="Favorites" isActive={isSelectionActive(selection, { kind: 'filter', filter: 'favorites' })} onClick={() => onSelect({ kind: 'filter', filter: 'favorites' })} />
          <NavItem icon={Archive} label="Archive" count={archivedCount} isActive={isSelectionActive(selection, { kind: 'filter', filter: 'archived' })} badgeClassName="text-muted-foreground" badgeStyle={{ background: 'var(--muted)' }} onClick={() => onSelect({ kind: 'filter', filter: 'archived' })} />
          <NavItem icon={TagSimple} label="Untagged" disabled />
          <NavItem icon={Trash} label="Trash" count={trashedCount} isActive={isSelectionActive(selection, { kind: 'filter', filter: 'trash' })} activeClassName="bg-destructive/10 text-destructive" badgeClassName="text-muted-foreground" badgeStyle={{ background: 'var(--muted)' }} onClick={() => onSelect({ kind: 'filter', filter: 'trash' })} />
          {modifiedCount > 0 && (
            <NavItem icon={GitDiff} label="Changes" count={modifiedCount} isActive={isSelectionActive(selection, { kind: 'filter', filter: 'changes' })} activeClassName="bg-[color:var(--accent-orange)]/10 text-[var(--accent-orange)]" badgeClassName="text-white" badgeStyle={{ background: 'var(--accent-orange)' }} onClick={() => onSelect({ kind: 'filter', filter: 'changes' })} />
          )}
        </div>

        {/* Sections header + visibility popover */}
        <div ref={customizeRef} style={{ position: 'relative', padding: '4px 6px 0' }}>
          <div className="flex w-full select-none items-center justify-between" style={{ padding: '4px 16px' }}>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Sections</span>
            <button className="flex shrink-0 cursor-pointer items-center justify-center rounded border-none bg-transparent p-0 text-muted-foreground transition-colors hover:text-foreground" style={{ width: 20, height: 20 }} onClick={() => setShowCustomize((v) => !v)} aria-label="Customize sections" title="Customize sections">
              <SlidersHorizontal size={14} />
            </button>
          </div>
          {showCustomize && <VisibilityPopover sections={allSectionGroups} isSectionVisible={isSectionVisible} onToggle={toggleVisibility} />}
        </div>

        {/* Sortable section groups */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
            {visibleSections.map((g) => (
              <SortableSection key={g.type} group={g} sectionProps={sectionProps} />
            ))}
          </SortableContext>
        </DndContext>
      </nav>

      <CommitButton modifiedCount={modifiedCount} onClick={onCommitPush} />
      <ContextMenuOverlay pos={contextMenuPos} type={contextMenuType} innerRef={contextMenuRef} onOpenCustomize={(type) => { closeContextMenu(); setCustomizeTarget(type) }} />
      <CustomizeOverlay target={customizeTarget} typeEntryMap={typeEntryMap} innerRef={popoverRef} onCustomize={handleCustomize} onChangeTemplate={handleChangeTemplate} onClose={closeCustomizeTarget} />
    </aside>
  )
})
