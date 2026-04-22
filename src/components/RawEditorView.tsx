import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import { trackEvent } from '../lib/telemetry'
import type { EditorView } from '@codemirror/view'
import { MIN_QUERY_LENGTH } from '../utils/wikilinkSuggestions'
import { buildTypeEntryMap } from '../utils/typeColors'
import { NoteSearchList } from './NoteSearchList'
import type { ResolvedAppearance } from '../lib/appearance'
import {
  buildRawEditorAutocompleteState,
  buildRawEditorBaseItems,
  detectYamlError,
  extractWikilinkQuery,
  getRawEditorDropdownPosition,
  replaceActiveWikilinkQuery,
  type RawEditorAutocompleteState,
} from '../utils/rawEditorUtils'
import { useCodeMirror } from '../hooks/useCodeMirror'
import type { VaultEntry } from '../types'

export interface RawEditorViewProps {
  content: string
  path: string
  entries: VaultEntry[]
  resolvedAppearance: ResolvedAppearance
  onContentChange: (path: string, content: string) => void
  vaultPath?: string
  onSave: () => void
  /** Mutable ref updated on every keystroke with the latest doc string.
   *  Allows the parent to flush debounced content before unmount. */
  latestContentRef?: React.MutableRefObject<string | null>
}

const DEBOUNCE_MS = 500
const DROPDOWN_MAX_HEIGHT = 200

export function RawEditorView({ content, path, entries, resolvedAppearance, onContentChange, onSave, latestContentRef, vaultPath }: RawEditorViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pathRef = useRef(path)
  const onContentChangeRef = useRef(onContentChange)
  const onSaveRef = useRef(onSave)
  const latestDocRef = useRef(content)
  useEffect(() => { pathRef.current = path }, [path])
  // Expose latest doc content to parent via ref
  useEffect(() => { if (latestContentRef) latestContentRef.current = content }, [latestContentRef, content])
  useEffect(() => { onContentChangeRef.current = onContentChange }, [onContentChange])
  useEffect(() => { onSaveRef.current = onSave }, [onSave])

  const [autocomplete, setAutocomplete] = useState<RawEditorAutocompleteState | null>(null)
  const [yamlError, setYamlError] = useState<string | null>(() => detectYamlError(content))

  const typeEntryMap = useMemo(() => buildTypeEntryMap(entries), [entries])

  const baseItems = useMemo(() => buildRawEditorBaseItems(entries), [entries])

  const insertWikilinkRef = useRef<(target: string) => void>(() => {})

  const latestContentRefStable = useRef(latestContentRef)
  useEffect(() => { latestContentRefStable.current = latestContentRef }, [latestContentRef])

  const handleDocChange = useCallback((doc: string) => {
    latestDocRef.current = doc
    if (latestContentRefStable.current) latestContentRefStable.current.current = doc
    setYamlError(detectYamlError(doc))
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onContentChangeRef.current(pathRef.current, doc)
    }, DEBOUNCE_MS)
  }, [])

  const handleCursorActivity = useCallback((view: EditorView) => {
    const doc = view.state.doc.toString()
    const cursor = view.state.selection.main.head
    const query = extractWikilinkQuery(doc, cursor)
    if (query === null || query.length < MIN_QUERY_LENGTH) {
      setAutocomplete(null)
      return
    }
    const nextAutocomplete = buildRawEditorAutocompleteState({
      view,
      baseItems,
      query,
      typeEntryMap,
      onInsertTarget: (target: string) => insertWikilinkRef.current(target),
      vaultPath: vaultPath ?? '',
    })
    setAutocomplete(nextAutocomplete)
  }, [baseItems, typeEntryMap, vaultPath])

  const handleSave = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
      onContentChangeRef.current(pathRef.current, latestDocRef.current)
    }
    onSaveRef.current()
  }, [])

  const handleEscape = useCallback(() => {
    if (autocomplete) { setAutocomplete(null); return true }
    return false
  }, [autocomplete])

  const viewRef = useCodeMirror(containerRef, content, resolvedAppearance === 'dark', {
    onDocChange: handleDocChange,
    onCursorActivity: handleCursorActivity,
    onSave: handleSave,
    onEscape: handleEscape,
  })

  const insertWikilink = useCallback((target: string) => {
    const view = viewRef.current
    if (!view) return
    const cursor = view.state.selection.main.head
    const doc = view.state.doc.toString()
    const replacement = replaceActiveWikilinkQuery(doc, cursor, target)
    if (!replacement) return

    view.dispatch({
      changes: { from: 0, to: doc.length, insert: replacement.text },
      selection: { anchor: replacement.cursor },
    })
    trackEvent('wikilink_inserted')
    setAutocomplete(null)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = null
    latestDocRef.current = replacement.text
    onContentChangeRef.current(pathRef.current, replacement.text)

    view.focus()
  }, [viewRef])

  useEffect(() => { insertWikilinkRef.current = insertWikilink }, [insertWikilink])

  const handleAutocompleteKey = useCallback((e: React.KeyboardEvent) => {
    if (!autocomplete) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setAutocomplete(prev => prev
        ? { ...prev, selectedIndex: Math.min(prev.selectedIndex + 1, prev.items.length - 1) }
        : null)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setAutocomplete(prev => prev
        ? { ...prev, selectedIndex: Math.max(prev.selectedIndex - 1, 0) }
        : null)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = autocomplete.items[autocomplete.selectedIndex]
      if (item) item.onItemClick()
    }
  }, [autocomplete])

  // Flush pending debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        onContentChangeRef.current(pathRef.current, latestDocRef.current)
      }
    }
  }, [])

  const dropdownPosition = getRawEditorDropdownPosition(autocomplete, DROPDOWN_MAX_HEIGHT, window)

  return (
    <div className="flex flex-1 flex-col min-h-0 relative" style={{ background: 'var(--background)' }} onKeyDown={handleAutocompleteKey} role="presentation">
      {yamlError && (
        <div
          className="flex items-center gap-2 px-4 py-2 text-xs border-b shrink-0"
          style={{
            background: 'var(--warning-bg)',
            borderColor: 'var(--warning-border)',
            color: 'var(--warning-text)',
          }}
          role="alert"
          data-testid="raw-editor-yaml-error"
        >
          <span style={{ fontWeight: 600 }}>YAML error:</span>
          <span>{yamlError}</span>
        </div>
      )}
      <div
        ref={containerRef}
        className="flex flex-1 min-h-0"
        data-testid="raw-editor-codemirror"
        aria-label="Raw editor"
      />
      {autocomplete && autocomplete.items.length > 0 && (
        <div
          className="fixed z-50 min-w-64 max-w-xs rounded-md border shadow-lg overflow-auto"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            maxHeight: DROPDOWN_MAX_HEIGHT,
            background: 'var(--popover)',
            borderColor: 'var(--border)',
          }}
          data-testid="raw-editor-wikilink-dropdown"
        >
          <NoteSearchList
            items={autocomplete.items}
            selectedIndex={autocomplete.selectedIndex}
            getItemKey={(item, i) => `${item.title}-${item.path ?? i}`}
            onItemClick={(item) => item.onItemClick()}
            onItemHover={(i) => setAutocomplete(prev => prev ? { ...prev, selectedIndex: i } : null)}
          />
        </div>
      )}
    </div>
  )
}
