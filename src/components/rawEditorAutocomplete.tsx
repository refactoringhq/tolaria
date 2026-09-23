import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { EditorView } from '@codemirror/view'
import { trackEvent } from '../lib/telemetry'
import { buildTypeEntryMap } from '../utils/typeColors'
import {
  buildRawEditorAutocompleteState,
  buildRawEditorBaseItems,
  extractWikilinkQuery,
  replaceActiveWikilinkQuery,
  type RawEditorAutocompleteState,
} from '../utils/rawEditorUtils'
import { MIN_QUERY_LENGTH } from '../utils/wikilinkSuggestions'
import type { VaultEntry } from '../types'

export const RAW_EDITOR_DROPDOWN_MAX_HEIGHT = 200

export type RawEditorPendingChangeRefs = {
  debounceRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
  latestDocRef: React.MutableRefObject<string>
  onContentChangeRef: React.MutableRefObject<(path: string, content: string) => void>
  pathRef: React.MutableRefObject<string>
}

export type RawEditorSetAutocomplete = React.Dispatch<
  React.SetStateAction<RawEditorAutocompleteState | null>
>

type RawEditorAutocompleteDirection = 'next' | 'previous'
type RawEditorTypeEntryMap = ReturnType<typeof buildTypeEntryMap>

function moveRawEditorAutocompleteSelection(
  autocomplete: RawEditorAutocompleteState,
  direction: RawEditorAutocompleteDirection,
): RawEditorAutocompleteState {
  const selectedIndex = direction === 'next'
    ? Math.min(autocomplete.selectedIndex + 1, autocomplete.items.length - 1)
    : Math.max(autocomplete.selectedIndex - 1, 0)

  return { ...autocomplete, selectedIndex }
}

function getRawEditorAutocompleteDirection(key: string): RawEditorAutocompleteDirection | null {
  if (key === 'ArrowDown') return 'next'
  if (key === 'ArrowUp') return 'previous'
  return null
}

function buildNextRawEditorAutocomplete({
  baseItems,
  insertWikilinkRef,
  sourceEntry,
  typeEntryMap,
  vaultPath,
  view,
}: {
  baseItems: ReturnType<typeof buildRawEditorBaseItems>
  insertWikilinkRef: React.MutableRefObject<(target: string) => void>
  sourceEntry?: VaultEntry
  typeEntryMap: RawEditorTypeEntryMap
  vaultPath?: string
  view: EditorView
}): RawEditorAutocompleteState | null {
  const doc = view.state.doc.toString()
  const cursor = view.state.selection.main.head
  const query = extractWikilinkQuery(doc, cursor)
  if (query === null || query.length < MIN_QUERY_LENGTH) return null

  return buildRawEditorAutocompleteState({
    view,
    baseItems,
    query,
    typeEntryMap,
    onInsertTarget: (target: string) => insertWikilinkRef.current(target),
    sourceEntry,
    vaultPath: vaultPath ?? '',
  })
}

function useRawEditorAutocompleteEscape(
  autocomplete: RawEditorAutocompleteState | null,
  setAutocomplete: RawEditorSetAutocomplete,
) {
  return useCallback(() => {
    if (!autocomplete) return false
    setAutocomplete(null)
    return true
  }, [autocomplete, setAutocomplete])
}

function useRawEditorSuggestionKey(
  autocomplete: RawEditorAutocompleteState | null,
  setAutocomplete: RawEditorSetAutocomplete,
) {
  return useCallback((key: string): boolean => {
    if (!autocomplete) return false

    if (key === 'Enter') {
      const selectedItem = autocomplete.items[autocomplete.selectedIndex]
      if (!selectedItem) return false
      selectedItem.onItemClick()
      return true
    }

    const direction = getRawEditorAutocompleteDirection(key)
    if (!direction) return false

    setAutocomplete((previous) => (
      previous ? moveRawEditorAutocompleteSelection(previous, direction) : null
    ))
    return true
  }, [autocomplete, setAutocomplete])
}

export function useRawEditorAutocompleteController({
  entries,
  sourceEntry,
  vaultPath,
}: {
  entries: VaultEntry[]
  sourceEntry?: VaultEntry
  vaultPath?: string
}) {
  const [autocomplete, setAutocomplete] = useState<RawEditorAutocompleteState | null>(null)
  const typeEntryMap = useMemo(() => buildTypeEntryMap(entries), [entries])
  const baseItems = useMemo(() => buildRawEditorBaseItems(entries), [entries])
  const insertWikilinkRef = useRef<(target: string) => void>(() => {})

  const handleCursorActivity = useCallback((view: EditorView) => {
    setAutocomplete(buildNextRawEditorAutocomplete({
      baseItems,
      insertWikilinkRef,
      sourceEntry,
      typeEntryMap,
      vaultPath,
      view,
    }))
  }, [baseItems, sourceEntry, typeEntryMap, vaultPath])

  const handleItemHover = useCallback((index: number) => {
    setAutocomplete((previous) => previous ? { ...previous, selectedIndex: index } : null)
  }, [])

  const handleEscape = useRawEditorAutocompleteEscape(autocomplete, setAutocomplete)
  const handleSuggestionKey = useRawEditorSuggestionKey(autocomplete, setAutocomplete)

  return {
    autocomplete,
    handleCursorActivity,
    handleEscape,
    handleItemHover,
    handleSuggestionKey,
    insertWikilinkRef,
    setAutocomplete,
  }
}

export function useRawEditorWikilinkInsertion({
  debounceRef,
  insertWikilinkRef,
  latestDocRef,
  onContentChangeRef,
  pathRef,
  setAutocomplete,
  viewRef,
}: RawEditorPendingChangeRefs & {
  insertWikilinkRef: React.MutableRefObject<(target: string) => void>
  setAutocomplete: RawEditorSetAutocomplete
  viewRef: React.MutableRefObject<EditorView | null>
}) {
  const applyWikilinkChange = useCallback(
    (view: EditorView, next: { text: string; cursor: number }) => {
      const doc = view.state.doc.toString()

      view.dispatch({
        changes: { from: 0, to: doc.length, insert: next.text },
        selection: { anchor: next.cursor },
      })
      trackEvent('wikilink_inserted')
      setAutocomplete(null)

      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = null
      latestDocRef.current = next.text
      onContentChangeRef.current(pathRef.current, next.text)
      view.focus()
    },
    [debounceRef, latestDocRef, onContentChangeRef, pathRef, setAutocomplete],
  )

  const insertAutocompleteWikilink = useCallback((target: string) => {
    const view = viewRef.current
    if (!view) return

    const cursor = view.state.selection.main.head
    const doc = view.state.doc.toString()
    const replacement = replaceActiveWikilinkQuery(doc, cursor, target)
    if (!replacement) return

    applyWikilinkChange(view, replacement)
  }, [applyWikilinkChange, viewRef])

  useEffect(() => {
    insertWikilinkRef.current = insertAutocompleteWikilink
  }, [insertAutocompleteWikilink, insertWikilinkRef])
}
