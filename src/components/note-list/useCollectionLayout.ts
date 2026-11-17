import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { collectionLayoutKey } from '../../collections/collectionLayoutKey'
import {
  COLLECTION_PRESENTATION_KANBAN,
  COLLECTION_PRESENTATION_LIST,
  type CollectionPresentationType,
} from '../../collections/collectionTypes'
import { trackEvent } from '../../lib/telemetry'
import type { SidebarSelection, VaultEntry } from '../../types'
import {
  availableCardProperties,
  availableGroupProperties,
  canUseVaultLayoutFile,
  configVaultPath,
  effectiveLayout,
  type LayoutPersistenceTarget,
  type LayoutSettings,
  persistedViewLayout,
  persistLayoutSettings,
  readStoredLayout,
} from './collectionLayoutConfig'
import { toggleColumnValue } from './kanbanModel'

export interface CollectionLayoutSource extends LayoutPersistenceTarget {
  visibleEntries: VaultEntry[]
  selectedNotePath?: string | null
}

type SettingsMap = Map<string, LayoutSettings>
type SetSettingsMap = React.Dispatch<React.SetStateAction<SettingsMap>>

function usePersistedLayout(source: CollectionLayoutSource, key: string) {
  const [storedConfigs, setStoredConfigs] = useState<SettingsMap>(() => new Map())
  const vaultPath = configVaultPath(source)
  const canLoad = canUseVaultLayoutFile(source.selection)
  useEffect(() => {
    if (!vaultPath || !canLoad) return
    let current = true
    void invoke<Record<string, unknown>>('list_collection_layouts', { vaultPath }).then((configs) => {
      const saved = readStoredLayout(Object.entries(configs).find(([collection]) => collection === key)?.[1])
      if (current && saved) setStoredConfigs((previous) => new Map(previous).set(key, saved))
    }).catch(() => undefined)
    return () => { current = false }
  }, [canLoad, key, vaultPath])
  return storedConfigs.get(key) ?? persistedViewLayout(source)
}

function isFormField(target: HTMLElement): boolean {
  return target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)
}

function isLayoutToggleShortcut(event: KeyboardEvent): boolean {
  if (event.target instanceof HTMLElement && isFormField(event.target)) return false
  return (event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'g'
}

function useLayoutShortcut(enabled: boolean, layout: CollectionPresentationType, changeLayout: (next: CollectionPresentationType) => void) {
  useEffect(() => {
    if (!enabled) return
    const toggle = () => changeLayout(layout === COLLECTION_PRESENTATION_LIST ? COLLECTION_PRESENTATION_KANBAN : COLLECTION_PRESENTATION_LIST)
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isLayoutToggleShortcut(event)) return
      event.preventDefault()
      toggle()
    }
    window.addEventListener('laputa:toggle-collection-layout', toggle)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('laputa:toggle-collection-layout', toggle)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [changeLayout, enabled, layout])
}

/** Tracks which open note the user dismissed, so the Kanban editor panel starts closed and reopens on a new card. */
function useKanbanPanel(key: string, layout: CollectionPresentationType, selectedNotePath: string | null) {
  const [dismissal, setDismissal] = useState({ key, layout, path: selectedNotePath })
  if (dismissal.key !== key || dismissal.layout !== layout) {
    setDismissal({ key, layout, path: selectedNotePath })
  }
  const open = layout === COLLECTION_PRESENTATION_KANBAN && selectedNotePath !== null && selectedNotePath !== dismissal.path
  const close = useCallback(() => setDismissal({ key, layout, path: selectedNotePath }), [key, layout, selectedNotePath])
  const reopen = useCallback(() => setDismissal({ key, layout, path: null }), [key, layout])
  return { open, close, reopen }
}

function sameLayoutSettings(left: LayoutSettings, right: LayoutSettings): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

interface ColumnToggleActions {
  added: string
  removed: string
}

const COLLAPSE_ACTIONS: ColumnToggleActions = { added: 'collapse', removed: 'expand' }
const HIDE_ACTIONS: ColumnToggleActions = { added: 'hide', removed: 'show' }

/** Toggles a column in a collapsed or hidden list and reports which way it went (never the column name). */
function toggledColumnList(list: readonly string[], group: string, actions: ColumnToggleActions): string[] {
  trackEvent('kanban_column_visibility_changed', { action: list.includes(group) ? actions.removed : actions.added })
  return toggleColumnValue(list, group)
}

function useLayoutActions(source: CollectionLayoutSource, key: string, current: LayoutSettings, setOverrides: SetSettingsMap) {
  const enabled = supportsLayouts(source.selection)
  const update = useCallback((patch: Partial<LayoutSettings>) => {
    const next = { ...current, ...patch }
    if (sameLayoutSettings(current, next)) return
    setOverrides((overrides) => new Map(overrides).set(key, next))
    persistLayoutSettings(source, next)
  }, [current, key, setOverrides, source])
  const changeLayout = useCallback((layout: CollectionPresentationType) => {
    if (layout === current.layout) return
    update({ layout })
    trackEvent('collection_layout_changed', { layout, collection: source.selection.kind })
  }, [current.layout, source.selection.kind, update])
  useLayoutShortcut(enabled, current.layout, changeLayout)
  return {
    changeLayout,
    changeGroupBy: (groupBy: string) => update({ groupBy }),
    changeCardProperties: (properties: string[] | null) => update({ properties: properties ?? [] }),
    changeColumnOrder: (columnOrder: string[]) => update({ columnOrder }),
    toggleColumnCollapsed: (group: string) => update({ collapsedColumns: toggledColumnList(current.collapsedColumns, group, COLLAPSE_ACTIONS) }),
    toggleColumnHidden: (group: string) => update({ hiddenColumns: toggledColumnList(current.hiddenColumns, group, HIDE_ACTIONS) }),
  }
}

/** Neighborhood and Changes lists have their own structure, so they always render as List. */
export function supportsLayouts(selection: SidebarSelection): boolean {
  if (selection.kind === 'entity') return false
  return !(selection.kind === 'filter' && selection.filter === 'changes')
}

function resolveCurrentLayout(source: CollectionLayoutSource, saved: LayoutSettings | undefined): LayoutSettings {
  const current = effectiveLayout(source.presentation, saved)
  return supportsLayouts(source.selection) ? current : { ...current, layout: COLLECTION_PRESENTATION_LIST }
}

export function useCollectionLayout(source: CollectionLayoutSource) {
  const key = collectionLayoutKey(source.selection)
  const [overrides, setOverrides] = useState<SettingsMap>(() => new Map())
  const persisted = usePersistedLayout(source, key)
  const current = resolveCurrentLayout(source, overrides.get(key) ?? persisted)
  const groups = useMemo(() => availableGroupProperties(source.visibleEntries), [source.visibleEntries])
  const cardFields = useMemo(
    () => availableCardProperties(source.visibleEntries, current.properties),
    [current.properties, source.visibleEntries],
  )
  const actions = useLayoutActions(source, key, current, setOverrides)
  const panel = useKanbanPanel(key, current.layout, source.selectedNotePath ?? null)
  return { ...current, enabled: supportsLayouts(source.selection), groups, cardFields, panel, ...actions }
}

export type CollectionLayoutState = ReturnType<typeof useCollectionLayout>
