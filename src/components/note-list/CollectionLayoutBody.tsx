import { invoke } from '@tauri-apps/api/core'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { collectionLayoutKey } from '../../collections/collectionLayoutKey'
import { COLLECTION_PRESENTATION_KANBAN, COLLECTION_PRESENTATION_LIST } from '../../collections/collectionTypes'
import { getCollectionLayout } from '../../collections/layoutRegistry'
import { translate } from '../../lib/i18n'
import { trackEvent } from '../../lib/telemetry'
import type { SidebarSelection, VaultEntry, ViewDefinition, ViewFile } from '../../types'
import { viewMatchesSelection } from '../../utils/viewIdentity'
import type { useNoteListModel } from './useNoteListModel'

type Model = ReturnType<typeof useNoteListModel>
type Props = Pick<Model, 'presentation' | 'selection' | 'visibleEntries' | 'views' | 'onUpdateViewDefinition' | 'handleClickNote' | 'onUpdateTypeSort' | 'locale' | 'vaultPath'> & { listContent: ReactNode }
type LayoutOverride = { layout: 'list' | 'kanban'; groupBy: string; properties: string[]; columnOrder: string[] }

function viewFor(selection: SidebarSelection, views: ViewFile[] | undefined) {
  return selection.kind === 'view' ? views?.find((view) => viewMatchesSelection(view, selection)) : undefined
}

function saveViewPresentation(props: Props, presentation: ViewDefinition['presentation']) {
  const view = viewFor(props.selection, props.views)
  if (!view || props.selection.kind !== 'view') return
  props.onUpdateViewDefinition?.(view.filename, { presentation }, props.selection.rootPath)
}

function persistKanban(props: Props, groupBy: string, properties: string[], columnOrder: string[]) {
  saveViewPresentation(props, { type: COLLECTION_PRESENTATION_KANBAN, groupBy, properties, columnOrder })
}

function persistLayoutChoice(props: Props, type: 'list' | 'kanban', groupBy: string, properties: string[], columnOrder: string[]) {
  const view = viewFor(props.selection, props.views)
  if (type === COLLECTION_PRESENTATION_KANBAN) {
    if (view) persistKanban(props, groupBy, properties, columnOrder)
    else persistCollectionConfig(props, { layout: type, groupBy, properties, columnOrder })
    return
  }
  if (view) saveViewPresentation(props, { type, sort: view.definition.sort, properties: view.definition.listPropertiesDisplay })
  else if (props.selection.kind !== 'entity') persistCollectionConfig(props, { layout: type, groupBy, properties, columnOrder })
}

function configVaultPath(props: Props): string | undefined {
  if (props.selection.kind === 'view' || props.selection.kind === 'folder') return props.selection.rootPath ?? props.vaultPath
  return props.vaultPath
}

function persistCollectionConfig(props: Props, config: LayoutOverride) {
  const vaultPath = configVaultPath(props)
  if (!vaultPath || props.selection.kind === 'view' || props.selection.kind === 'entity') return
  void invoke('save_collection_layout_cmd', {
    vaultPath,
    collection: collectionLayoutKey(props.selection),
    presentation: {
      type: config.layout,
      groupBy: config.groupBy,
      columnOrder: config.columnOrder,
      properties: config.properties,
    },
  }).catch(() => undefined)
}

function isConfigRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isLayoutType(value: unknown): value is LayoutOverride['layout'] {
  return value === COLLECTION_PRESENTATION_LIST || value === COLLECTION_PRESENTATION_KANBAN
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function readStoredConfig(value: unknown): LayoutOverride | undefined {
  if (!isConfigRecord(value) || !isLayoutType(value.type)) return undefined
  return {
    layout: value.type,
    groupBy: typeof value.groupBy === 'string' ? value.groupBy : 'status',
    properties: stringArray(value.properties),
    columnOrder: stringArray(value.columnOrder),
  }
}

function addStatusProperty(keys: Set<string>, entry: VaultEntry) {
  if (entry.status) keys.add('status')
}

function isScalarProperty(value: unknown) {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value)
}

function addScalarProperties(keys: Set<string>, entry: VaultEntry) {
  Object.entries(entry.properties).forEach(([key, value]) => {
    if (key.trim() && isScalarProperty(value)) keys.add(key)
  })
}

function availableGroupProperties(entries: VaultEntry[]) {
  const keys = new Set<string>()
  entries.forEach((entry) => {
    addStatusProperty(keys, entry)
    addScalarProperties(keys, entry)
  })
  return [...keys]
}

function availableCardProperties(entries: VaultEntry[], configured: string[]) {
  const keys = new Set(configured)
  for (const entry of entries) {
    addStatusProperty(keys, entry)
    for (const property of Object.keys(entry.properties)) {
      if (property.trim()) keys.add(property)
    }
  }
  return [...keys].sort((left, right) => left.localeCompare(right))
}

function chooseLayout(props: Props, saved: LayoutOverride | undefined) {
  return saved ? saved.layout : props.presentation.type
}

function chooseGroupBy(props: Props, saved: LayoutOverride | undefined) {
  if (saved?.groupBy) return saved.groupBy
  if (props.presentation.type === COLLECTION_PRESENTATION_KANBAN && props.presentation.groupBy) return props.presentation.groupBy
  return 'status'
}

function chooseProperties(props: Props, saved: LayoutOverride | undefined) {
  if (saved) return saved.properties
  if (props.presentation.type === COLLECTION_PRESENTATION_KANBAN) return props.presentation.properties
  return []
}

function chooseColumnOrder(props: Props, saved: LayoutOverride | undefined) {
  if (saved) return saved.columnOrder
  return props.presentation.type === COLLECTION_PRESENTATION_KANBAN ? props.presentation.columnOrder : []
}

function effectiveLayout(props: Props, saved: LayoutOverride | undefined): LayoutOverride {
  return { layout: chooseLayout(props, saved), groupBy: chooseGroupBy(props, saved), properties: chooseProperties(props, saved), columnOrder: chooseColumnOrder(props, saved) }
}

function setCollectionOverride(
  setter: React.Dispatch<React.SetStateAction<Record<string, LayoutOverride>>>,
  key: string,
  current: LayoutOverride,
  patch: Partial<LayoutOverride>,
) {
  setter((overrides) => ({ ...overrides, [key]: { ...current, ...patch } }))
}

function usePersistedLayoutConfig(props: Props, key: string) {
  const [storedConfigs, setStoredConfigs] = useState<Record<string, LayoutOverride>>({})
  const vaultPath = configVaultPath(props)
  const canLoadVaultConfig = props.selection.kind !== 'view' && props.selection.kind !== 'entity'
  useEffect(() => {
    if (!vaultPath || !canLoadVaultConfig) return
    let current = true
    void invoke<Record<string, unknown>>('list_collection_layouts', { vaultPath }).then((configs) => {
      if (!current) return
      const saved = readStoredConfig(configs[key])
      if (saved) setStoredConfigs((previous) => ({ ...previous, [key]: saved }))
    }).catch(() => undefined)
    return () => { current = false }
  }, [canLoadVaultConfig, key, vaultPath])
  const persistedViewConfig = props.selection.kind === 'view' && props.presentation.type === COLLECTION_PRESENTATION_KANBAN
    ? { layout: 'kanban' as const, groupBy: props.presentation.groupBy ?? 'status', properties: props.presentation.properties, columnOrder: props.presentation.columnOrder }
    : undefined
  return storedConfigs[key] ?? persistedViewConfig
}

function useLayoutActions(
  props: Props,
  key: string,
  current: LayoutOverride,
  setOverrides: React.Dispatch<React.SetStateAction<Record<string, LayoutOverride>>>,
) {
  const { layout, groupBy, properties: cardProperties, columnOrder } = current
  const saveKanban = (nextGroupBy: string, nextProperties: string[]) => {
    const next = { layout: COLLECTION_PRESENTATION_KANBAN, groupBy: nextGroupBy, properties: nextProperties, columnOrder } as const
    setCollectionOverride(setOverrides, key, current, next)
    if (viewFor(props.selection, props.views)) persistKanban(props, nextGroupBy, nextProperties, columnOrder)
    else persistCollectionConfig(props, next)
  }
  const changeColumnOrder = (nextOrder: string[]) => {
    setCollectionOverride(setOverrides, key, current, { columnOrder: nextOrder })
    const next = { ...current, columnOrder: nextOrder }
    if (viewFor(props.selection, props.views)) persistKanban(props, groupBy, cardProperties, nextOrder)
    else persistCollectionConfig(props, next)
  }
  const changeLayout = (nextType: typeof COLLECTION_PRESENTATION_LIST | typeof COLLECTION_PRESENTATION_KANBAN) => {
    setCollectionOverride(setOverrides, key, current, { layout: nextType })
    persistLayoutChoice(props, nextType, groupBy, cardProperties, columnOrder)
    trackEvent('collection_layout_changed', { layout: nextType, collection: props.selection.kind })
  }
  useLayoutShortcut(layout, changeLayout)
  return { saveKanban, changeLayout, changeColumnOrder }
}

function useLayoutShortcut(
  layout: LayoutOverride['layout'],
  changeLayout: (nextType: LayoutOverride['layout']) => void,
) {
  useEffect(() => {
    const toggle = () => changeLayout(layout === COLLECTION_PRESENTATION_LIST
      ? COLLECTION_PRESENTATION_KANBAN
      : COLLECTION_PRESENTATION_LIST)
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      const isEditing = target instanceof HTMLElement && (
        target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)
      )
      if (isEditing || !(event.ctrlKey || event.metaKey) || !event.shiftKey || event.key.toLowerCase() !== 'g') return
      event.preventDefault()
      toggle()
    }
    window.addEventListener('laputa:toggle-collection-layout', toggle)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('laputa:toggle-collection-layout', toggle)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [changeLayout, layout])
}

function useLayoutConfig(props: Props) {
  const key = collectionLayoutKey(props.selection)
  const [overrides, setOverrides] = useState<Record<string, LayoutOverride>>({})
  const persisted = usePersistedLayoutConfig(props, key)
  const current = effectiveLayout(props, overrides[key] ?? persisted)
  const { layout, groupBy, properties: cardProperties, columnOrder } = current
  const groups = useMemo(() => availableGroupProperties(props.visibleEntries), [props.visibleEntries])
  const cardFields = useMemo(
    () => availableCardProperties(props.visibleEntries, cardProperties),
    [cardProperties, props.visibleEntries],
  )
  const actions = useLayoutActions(props, key, current, setOverrides)
  return { layout, groupBy, cardProperties, columnOrder, groups, cardFields, ...actions }
}

export function CollectionLayoutBody(props: Props) {
  const config = useLayoutConfig(props)
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('laputa:collection-layout-state', { detail: config.layout }))
  }, [config.layout])
  const layoutRenderer = getCollectionLayout(config.layout)
  const missingProperty = layoutRenderer.requiredProperties({ groupBy: config.groupBy })
    .find((property) => !config.groups.includes(property))
  const renderedContent = missingProperty
    ? <div className="p-6 text-sm text-muted-foreground">{translate(props.locale, 'layout.noPropertyValues', { property: missingProperty })}</div>
    : layoutRenderer.render({
      listContent: props.listContent,
      entries: props.visibleEntries,
      groupBy: config.groupBy,
      properties: config.cardProperties,
      columnOrder: config.columnOrder,
      onColumnOrderChange: config.changeColumnOrder,
      locale: props.locale,
      onOpen: props.handleClickNote,
      onMove: (entry, value) => props.onUpdateTypeSort?.(entry.path, config.groupBy, value),
    })
  return (
    <>
      <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
        <label htmlFor="note-layout" className="text-xs text-muted-foreground">{translate(props.locale, 'layout.label')}</label>
        <select id="note-layout" aria-label="Layout" className="h-7 rounded border border-border bg-background px-2 text-xs" value={config.layout} onChange={(event) => config.changeLayout(event.target.value as typeof config.layout)}>
          <option value={COLLECTION_PRESENTATION_LIST}>{translate(props.locale, 'layout.list')}</option>
          <option value={COLLECTION_PRESENTATION_KANBAN}>{translate(props.locale, 'layout.kanban')}</option>
        </select>
        {config.layout === COLLECTION_PRESENTATION_KANBAN && <>
          <label htmlFor="kanban-group-by" className="ml-2 text-xs text-muted-foreground">{translate(props.locale, 'layout.groupBy')}</label>
          <select id="kanban-group-by" aria-label="Group by" className="h-7 max-w-40 rounded border border-border bg-background px-2 text-xs" value={config.groupBy} onChange={(event) => config.saveKanban(event.target.value, config.cardProperties)}>
            {!config.groups.includes(config.groupBy) && <option value={config.groupBy}>{config.groupBy}</option>}
            {config.groups.map((property) => <option key={property} value={property}>{property}</option>)}
          </select>
          <details className="relative ml-auto text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">{translate(props.locale, 'layout.cardFields')}</summary>
            <div className="absolute right-0 top-full z-20 mt-1 flex min-w-40 flex-col gap-2 rounded-md border border-border bg-popover p-3 text-popover-foreground shadow-md">
              {config.cardFields.map((property) => (
                <label key={property} className="flex items-center gap-2 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={config.cardProperties.includes(property)}
                    onChange={(event) => config.saveKanban(
                      config.groupBy,
                      event.target.checked
                        ? [...config.cardProperties, property]
                        : config.cardProperties.filter((value) => value !== property),
                    )}
                  />
                  {property}
                </label>
              ))}
            </div>
          </details>
        </>}
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {renderedContent}
      </div>
    </>
  )
}
