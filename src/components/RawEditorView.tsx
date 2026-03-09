import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import type { EditorView } from '@codemirror/view'
import { preFilterWikilinks, deduplicateByPath, MIN_QUERY_LENGTH } from '../utils/wikilinkSuggestions'
import { attachClickHandlers, enrichSuggestionItems } from '../utils/suggestionEnrichment'
import { buildTypeEntryMap } from '../utils/typeColors'
import { NoteSearchList } from './NoteSearchList'
import { extractWikilinkQuery, detectYamlError } from '../utils/rawEditorUtils'
import { useCodeMirror } from '../hooks/useCodeMirror'
import type { WikilinkSuggestionItem } from './WikilinkSuggestionMenu'
import type { VaultEntry } from '../types'

interface AutocompleteState {
  caretTop: number
  caretLeft: number
  selectedIndex: number
  items: WikilinkSuggestionItem[]
}

export interface RawEditorViewProps {
  content: string
  path: string
  entries: VaultEntry[]
  onContentChange: (path: string, content: string) => void
  onSave: () => void
  isDark?: boolean
}

const DEBOUNCE_MS = 500
const DROPDOWN_MAX_HEIGHT = 200

function getCursorCoords(view: EditorView): { top: number; left: number } | null {
  const pos = view.state.selection.main.head
  const coords = view.coordsAtPos(pos)
  if (!coords) return null
  return { top: coords.bottom, left: coords.left }
}

export function RawEditorView({ content, path, entries, onContentChange, onSave, isDark = false }: RawEditorViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pathRef = useRef(path)
  const onContentChangeRef = useRef(onContentChange)
  const onSaveRef = useRef(onSave)
  const latestDocRef = useRef(content)
  useEffect(() => { pathRef.current = path }, [path])
  useEffect(() => { onContentChangeRef.current = onContentChange }, [onContentChange])
  useEffect(() => { onSaveRef.current = onSave }, [onSave])

  const [autocomplete, setAutocomplete] = useState<AutocompleteState | null>(null)
  const [yamlError, setYamlError] = useState<string | null>(() => detectYamlError(content))

  const typeEntryMap = useMemo(() => buildTypeEntryMap(entries), [entries])

  const baseItems = useMemo(
    () => deduplicateByPath(entries.filter(e => !e.trashed).map(entry => ({
      title: entry.title,
      aliases: [...new Set([entry.filename.replace(/\.md$/, ''), ...entry.aliases])],
      group: entry.isA || 'Note',
      entryTitle: entry.title,
      path: entry.path,
    }))),
    [entries],
  )

  const insertWikilinkRef = useRef<(entryTitle: string) => void>(() => {})

  const handleDocChange = useCallback((doc: string) => {
    latestDocRef.current = doc
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
    const coords = getCursorCoords(view)
    if (!coords) { setAutocomplete(null); return }
    const candidates = preFilterWikilinks(baseItems, query)
    const withHandlers = attachClickHandlers(candidates, (title: string) => insertWikilinkRef.current(title))
    const items = enrichSuggestionItems(withHandlers, query, typeEntryMap)
    setAutocomplete({ caretTop: coords.top, caretLeft: coords.left, selectedIndex: 0, items })
  }, [baseItems, typeEntryMap])

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

  const viewRef = useCodeMirror(containerRef, content, isDark, {
    onDocChange: handleDocChange,
    onCursorActivity: handleCursorActivity,
    onSave: handleSave,
    onEscape: handleEscape,
  })

  const insertWikilink = useCallback((entryTitle: string) => {
    const view = viewRef.current
    if (!view) return
    const cursor = view.state.selection.main.head
    const doc = view.state.doc.toString()
    const before = doc.slice(0, cursor)
    const triggerIdx = before.lastIndexOf('[[')
    if (triggerIdx === -1) return

    const after = doc.slice(cursor)
    const newText = `${doc.slice(0, triggerIdx)}[[${entryTitle}]]${after}`
    const newCursor = triggerIdx + entryTitle.length + 4

    view.dispatch({
      changes: { from: 0, to: doc.length, insert: newText },
      selection: { anchor: newCursor },
    })
    setAutocomplete(null)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = null
    latestDocRef.current = newText
    onContentChangeRef.current(pathRef.current, newText)

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
      if (item) insertWikilink(item.entryTitle ?? item.title)
    }
  }, [autocomplete, insertWikilink])

  // Flush pending debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        onContentChangeRef.current(pathRef.current, latestDocRef.current)
      }
    }
  }, [])

  const dropdownBelow = autocomplete
    ? autocomplete.caretTop + 20 + DROPDOWN_MAX_HEIGHT <= window.innerHeight
    : true
  const dropdownTop = autocomplete
    ? (dropdownBelow ? autocomplete.caretTop + 4 : autocomplete.caretTop - DROPDOWN_MAX_HEIGHT - 24)
    : 0
  const dropdownLeft = autocomplete
    ? Math.min(autocomplete.caretLeft, window.innerWidth - 260)
    : 0

  return (
    <div className="flex flex-1 flex-col min-h-0 relative" style={{ background: 'var(--background)' }} onKeyDown={handleAutocompleteKey} role="presentation">
      {yamlError && (
        <div
          className="flex items-center gap-2 px-4 py-2 text-xs border-b shrink-0"
          style={{ background: '#fef3c7', borderColor: '#d97706', color: '#92400e' }}
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
            top: dropdownTop,
            left: dropdownLeft,
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
            onItemClick={(item) => insertWikilink(item.entryTitle ?? item.title)}
            onItemHover={(i) => setAutocomplete(prev => prev ? { ...prev, selectedIndex: i } : null)}
          />
        </div>
      )}
    </div>
  )
}
