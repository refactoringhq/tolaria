import {
  useMemo, useCallback, type Dispatch, type Ref, type RefObject, type SetStateAction,
} from 'react'
import type { VaultEntry, SidebarSelection, ViewFile } from '../../types'
import { evaluateView } from '../../utils/viewFilters'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { SlidersHorizontal } from 'lucide-react'
import {
  FileText, Trash, Archive, CaretLeft, Tray, CaretRight, CaretDown, Plus, Funnel, PencilSimple,
} from '@phosphor-icons/react'
import {
  type SectionGroup, isSelectionActive, NavItem, SectionContent, VisibilityPopover,
} from '../SidebarParts'
import { TypeCustomizePopover } from '../TypeCustomizePopover'
import { useDragRegion } from '../../hooks/useDragRegion'
import { buildTypeEntryMap, getTypeColor, getTypeLightColor } from '../../utils/typeColors'
import { NoteTitleIcon } from '../NoteTitleIcon'

export interface SidebarSectionProps {
  entries: VaultEntry[]
  selection: SidebarSelection
  onSelect: (selection: SidebarSelection) => void
  onContextMenu: (event: React.MouseEvent, type: string) => void
  renamingType: string | null
  renameInitialValue: string
  onRenameSubmit: (value: string) => void
  onRenameCancel: () => void
}

function SidebarGroupHeader({
  label,
  collapsed,
  onToggle,
  count,
  children,
}: {
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
        <span
          className="flex items-center justify-center text-muted-foreground"
          style={{ height: 18, borderRadius: 9999, padding: '0 5px', fontSize: 10, background: 'var(--muted)' }}
        >
          {count}
        </span>
      ))}
    </button>
  )
}

function ViewItem({
  view,
  isActive,
  onSelect,
  onEditView,
  onDeleteView,
  entries,
}: {
  view: ViewFile
  isActive: boolean
  onSelect: () => void
  onEditView?: (filename: string) => void
  onDeleteView?: (filename: string) => void
  entries: VaultEntry[]
}) {
  const count = useMemo(() => evaluateView(view.definition, entries).length, [view.definition, entries])

  return (
    <div className="group relative [&>button>span:last-child]:transition-opacity group-hover:[&>button>span:last-child]:opacity-0 group-focus-within:[&>button>span:last-child]:opacity-0">
      <NavItem
        icon={Funnel}
        emoji={view.definition.icon}
        label={view.definition.name}
        count={count}
        isActive={isActive}
        onClick={onSelect}
      />
      <div className="pointer-events-none absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
        {onEditView && (
          <button
            className="rounded p-0.5 text-muted-foreground hover:text-foreground"
            onClick={(event) => { event.stopPropagation(); onEditView(view.filename) }}
            title="Edit view"
          >
            <PencilSimple size={12} />
          </button>
        )}
        {onDeleteView && (
          <button
            className="rounded p-0.5 text-muted-foreground hover:text-destructive"
            onClick={(event) => { event.stopPropagation(); onDeleteView(view.filename) }}
            title="Delete view"
          >
            <Trash size={12} />
          </button>
        )}
      </div>
    </div>
  )
}

export function SidebarTopNav({
  selection,
  onSelect,
  showInbox,
  inboxCount,
  activeCount,
  archivedCount,
}: {
  selection: SidebarSelection
  onSelect: (selection: SidebarSelection) => void
  showInbox: boolean
  inboxCount: number
  activeCount: number
  archivedCount: number
}) {
  return (
    <div className="border-b border-border" data-testid="sidebar-top-nav" style={{ padding: '4px 6px' }}>
      {showInbox && (
        <NavItem
          icon={Tray}
          label="Inbox"
          count={inboxCount}
          isActive={isSelectionActive(selection, { kind: 'filter', filter: 'inbox' })}
          badgeClassName="text-muted-foreground"
          badgeStyle={{ background: 'var(--muted)' }}
          activeBadgeClassName="bg-primary text-primary-foreground"
          onClick={() => onSelect({ kind: 'filter', filter: 'inbox' })}
        />
      )}
      <NavItem
        icon={FileText}
        label="All Notes"
        count={activeCount}
        isActive={isSelectionActive(selection, { kind: 'filter', filter: 'all' })}
        badgeClassName="text-muted-foreground"
        badgeStyle={{ background: 'var(--muted)' }}
        activeBadgeClassName="bg-primary text-primary-foreground"
        onClick={() => onSelect({ kind: 'filter', filter: 'all' })}
      />
      <NavItem
        icon={Archive}
        label="Archive"
        count={archivedCount}
        isActive={isSelectionActive(selection, { kind: 'filter', filter: 'archived' })}
        badgeClassName="text-muted-foreground"
        badgeStyle={{ background: 'var(--muted)' }}
        activeBadgeClassName="bg-primary text-primary-foreground"
        onClick={() => onSelect({ kind: 'filter', filter: 'archived' })}
      />
    </div>
  )
}

export function ViewsSection({
  views,
  selection,
  onSelect,
  collapsed,
  onToggle,
  onCreateView,
  onEditView,
  onDeleteView,
  entries,
}: {
  views: ViewFile[]
  selection: SidebarSelection
  onSelect: (selection: SidebarSelection) => void
  collapsed: boolean
  onToggle: () => void
  onCreateView?: () => void
  onEditView?: (filename: string) => void
  onDeleteView?: (filename: string) => void
  entries: VaultEntry[]
}) {
  return (
    <div className="border-b border-border" style={{ padding: '0 6px' }}>
      <SidebarGroupHeader label="VIEWS" collapsed={collapsed} onToggle={onToggle}>
        {onCreateView && (
          <Plus
            size={12}
            className="text-muted-foreground hover:text-foreground"
            onClick={(event) => { event.stopPropagation(); onCreateView() }}
          />
        )}
      </SidebarGroupHeader>
      {!collapsed && (
        <div style={{ paddingBottom: 4 }}>
          {views.map((view) => (
            <ViewItem
              key={view.filename}
              view={view}
              isActive={isSelectionActive(selection, { kind: 'view', filename: view.filename })}
              onSelect={() => onSelect({ kind: 'view', filename: view.filename })}
              onEditView={onEditView}
              onDeleteView={onDeleteView}
              entries={entries}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SortableSection({
  group,
  sectionProps,
}: {
  group: SectionGroup
  sectionProps: SidebarSectionProps
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: group.type })
  const itemCount = sectionProps.entries.filter((entry) =>
    !entry.archived && (group.type === 'Note' ? (entry.isA === 'Note' || !entry.isA) : entry.isA === group.type),
  ).length
  const isRenaming = sectionProps.renamingType === group.type

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        padding: '0 6px',
      }}
      {...attributes}
    >
      <SectionContent
        group={group}
        itemCount={itemCount}
        selection={sectionProps.selection}
        onSelect={sectionProps.onSelect}
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

export function TypesSection({
  visibleSections,
  allSectionGroups,
  sectionIds,
  sensors,
  handleDragEnd,
  sectionProps,
  collapsed,
  onToggle,
  showCustomize,
  setShowCustomize,
  isSectionVisible,
  toggleVisibility,
  onCreateNewType,
  customizeRef,
}: {
  visibleSections: SectionGroup[]
  allSectionGroups: SectionGroup[]
  sectionIds: string[]
  sensors: ReturnType<typeof useSensors>
  handleDragEnd: (event: DragEndEvent) => void
  sectionProps: SidebarSectionProps
  collapsed: boolean
  onToggle: () => void
  showCustomize: boolean
  setShowCustomize: Dispatch<SetStateAction<boolean>>
  isSectionVisible: (type: string) => boolean
  toggleVisibility: (type: string) => void
  onCreateNewType?: () => void
  customizeRef: RefObject<HTMLDivElement | null>
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
              onClick={(event) => { event.stopPropagation(); setShowCustomize((value) => !value) }}
            >
              <SlidersHorizontal size={12} className="text-muted-foreground hover:text-foreground" />
            </span>
            {onCreateNewType && (
              <Plus
                size={12}
                className="text-muted-foreground hover:text-foreground"
                data-testid="create-type-btn"
                onClick={(event) => { event.stopPropagation(); onCreateNewType() }}
              />
            )}
          </div>
        </SidebarGroupHeader>
        {showCustomize && (
          <VisibilityPopover
            sections={allSectionGroups}
            isSectionVisible={isSectionVisible}
            onToggle={toggleVisibility}
          />
        )}
      </div>
      {!collapsed && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
            {visibleSections.map((group) => (
              <SortableSection key={group.type} group={group} sectionProps={sectionProps} />
            ))}
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}

const FAVORITE_TYPE_ICON_MAP: Record<string, string> = {
  Project: 'wrench',
  project: 'wrench',
  Experiment: 'flask',
  experiment: 'flask',
  Responsibility: 'target',
  responsibility: 'target',
  Procedure: 'arrows-clockwise',
  procedure: 'arrows-clockwise',
  Person: 'users',
  person: 'users',
  Event: 'calendar-blank',
  event: 'calendar-blank',
  Topic: 'tag',
  topic: 'tag',
  Type: 'stack-simple',
  type: 'stack-simple',
}

function getFavoriteIcon(entry: VaultEntry, typeEntryMap: Record<string, VaultEntry>) {
  const typeEntry = entry.isA ? typeEntryMap[entry.isA] : undefined
  return entry.icon ?? typeEntry?.icon ?? FAVORITE_TYPE_ICON_MAP[entry.isA ?? ''] ?? 'file-text'
}

function SortableFavoriteItem({
  entry,
  isActive,
  onSelect,
  typeEntryMap,
}: {
  entry: VaultEntry
  isActive: boolean
  onSelect: () => void
  typeEntryMap: Record<string, VaultEntry>
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entry.path })
  const typeEntry = entry.isA ? typeEntryMap[entry.isA] : undefined
  const icon = getFavoriteIcon(entry, typeEntryMap)
  const typeColor = getTypeColor(entry.isA ?? null, typeEntry?.color)
  const typeLightColor = getTypeLightColor(entry.isA ?? null, typeEntry?.color)

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      {...attributes}
      {...listeners}
    >
      <div
        className={`group/section flex cursor-pointer select-none items-center justify-between rounded transition-colors ${isActive ? '' : 'hover:bg-accent'}`}
        style={{ padding: '6px 8px 6px 16px', borderRadius: 4, gap: 4, ...(isActive ? { background: typeLightColor } : {}) }}
        onClick={onSelect}
      >
        <div className="flex min-w-0 flex-1 items-center" style={{ gap: 4 }}>
          <NoteTitleIcon icon={icon} size={16} color={typeColor} />
          <span className="truncate text-[13px] font-medium" style={{ marginLeft: 4, color: isActive ? typeColor : undefined }}>
            {entry.title}
          </span>
        </div>
      </div>
    </div>
  )
}

function sortFavorites(entries: VaultEntry[]) {
  return entries
    .filter((entry) => entry.favorite && !entry.archived)
    .sort((a, b) => (a.favoriteIndex ?? Infinity) - (b.favoriteIndex ?? Infinity))
}

function reorderFavoriteIds(favoriteIds: string[], event: DragEndEvent) {
  const { active, over } = event
  if (!over || active.id === over.id) return null
  const oldIndex = favoriteIds.indexOf(active.id as string)
  const newIndex = favoriteIds.indexOf(over.id as string)
  if (oldIndex === -1 || newIndex === -1) return null
  return arrayMove(favoriteIds, oldIndex, newIndex)
}

export function FavoritesSection({
  entries,
  selection,
  onSelect,
  onSelectNote,
  onReorder,
  collapsed,
  onToggle,
}: {
  entries: VaultEntry[]
  selection: SidebarSelection
  onSelect: (selection: SidebarSelection) => void
  onSelectNote?: (entry: VaultEntry) => void
  onReorder?: (orderedPaths: string[]) => void
  collapsed: boolean
  onToggle: () => void
}) {
  const favorites = useMemo(() => sortFavorites(entries), [entries])
  const favoriteIds = useMemo(() => favorites.map((entry) => entry.path), [favorites])
  const typeEntryMap = useMemo(() => buildTypeEntryMap(entries), [entries])
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const reordered = reorderFavoriteIds(favoriteIds, event)
    if (reordered) onReorder?.(reordered)
  }, [favoriteIds, onReorder])

  if (favorites.length === 0) return null

  return (
    <div style={{ padding: '0 6px' }}>
      <SidebarGroupHeader label="FAVORITES" collapsed={collapsed} onToggle={onToggle} count={favorites.length} />
      {!collapsed && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={favoriteIds} strategy={verticalListSortingStrategy}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingBottom: 4 }}>
              {favorites.map((entry) => (
                <SortableFavoriteItem
                  key={entry.path}
                  entry={entry}
                  isActive={isSelectionActive(selection, { kind: 'entity', entry })}
                  typeEntryMap={typeEntryMap}
                  onSelect={() => {
                    onSelect({ kind: 'filter', filter: 'favorites' })
                    onSelectNote?.(entry)
                  }}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}

export function SidebarTitleBar({ onCollapse }: { onCollapse?: () => void }) {
  const { onMouseDown } = useDragRegion()

  return (
    <div
      className="shrink-0 flex items-center justify-end border-b border-border"
      style={{ height: 52, padding: '0 8px', paddingLeft: 80, cursor: 'default' }}
      onMouseDown={onMouseDown}
    >
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

export function ContextMenuOverlay({
  pos,
  type,
  innerRef,
  onOpenCustomize,
  onStartRename,
}: {
  pos: { x: number; y: number } | null
  type: string | null
  innerRef: Ref<HTMLDivElement>
  onOpenCustomize: (type: string) => void
  onStartRename: (type: string) => void
}) {
  if (!pos || !type) return null

  const buttonClass = 'flex w-full items-center gap-2 rounded-sm border-none bg-transparent px-2 py-1.5 text-left text-sm cursor-default transition-colors hover:bg-accent hover:text-accent-foreground'

  return (
    <div
      ref={innerRef}
      className="fixed z-50 rounded-md border bg-popover p-1 shadow-md"
      style={{ left: pos.x, top: pos.y, minWidth: 180 }}
    >
      <button className={buttonClass} onClick={() => onStartRename(type)}>
        Rename section…
      </button>
      <button className={buttonClass} onClick={() => onOpenCustomize(type)}>
        Customize icon &amp; color…
      </button>
    </div>
  )
}

export function CustomizeOverlay({
  target,
  typeEntryMap,
  innerRef,
  onCustomize,
  onChangeTemplate,
  onClose,
}: {
  target: string | null
  typeEntryMap: Record<string, VaultEntry>
  innerRef: Ref<HTMLDivElement>
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
