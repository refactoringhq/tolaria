import { useEffect, useCallback, useMemo, useRef } from 'react'
import { useCreateBlockNote, SuggestionMenuController } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/mantine'
import { useEditorTheme } from '../hooks/useTheme'
import { useImageDrop } from '../hooks/useImageDrop'
import { buildTypeEntryMap } from '../utils/typeColors'
import { preFilterWikilinks, deduplicateByPath, MIN_QUERY_LENGTH } from '../utils/wikilinkSuggestions'
import { filterPersonMentions, PERSON_MENTION_MIN_QUERY } from '../utils/personMentionSuggestions'
import { attachClickHandlers, enrichSuggestionItems } from '../utils/suggestionEnrichment'
import { WikilinkSuggestionMenu, type WikilinkSuggestionItem } from './WikilinkSuggestionMenu'
import type { VaultEntry } from '../types'
import { _wikilinkEntriesRef } from './editorSchema'

/** Insert an image block after the current cursor position. */
function useInsertImageCallback(editor: ReturnType<typeof useCreateBlockNote>) {
  const editorRef = useRef(editor)
  useEffect(() => { editorRef.current = editor }, [editor])
  return useCallback((url: string) => {
    const e = editorRef.current
    const cursorBlock = e.getTextCursorPosition().block
    e.insertBlocks([{ type: 'image' as const, props: { url } }], cursorBlock, 'after')
  }, [])
}

/** Single BlockNote editor view — content is swapped via replaceBlocks */
export function SingleEditorView({ editor, entries, onNavigateWikilink, onChange, vaultPath, isDarkTheme, editable = true }: {
  editor: ReturnType<typeof useCreateBlockNote>
  entries: VaultEntry[]
  onNavigateWikilink: (target: string) => void
  onChange?: () => void
  vaultPath?: string
  isDarkTheme?: boolean
  editable?: boolean
}) {
  const navigateRef = useRef(onNavigateWikilink)
  useEffect(() => { navigateRef.current = onNavigateWikilink }, [onNavigateWikilink])
  const { cssVars } = useEditorTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const onImageUrl = useInsertImageCallback(editor)
  const { isDragOver } = useImageDrop({ containerRef, onImageUrl, vaultPath })

  useEffect(() => {
    _wikilinkEntriesRef.current = entries
  }, [entries])

  useEffect(() => {
    const container = document.querySelector('.editor__blocknote-container')
    if (!container) return
    const handler = (e: MouseEvent) => {
      const wikilink = (e.target as HTMLElement).closest('.wikilink')
      if (wikilink) {
        e.preventDefault()
        e.stopPropagation()
        const target = (wikilink as HTMLElement).dataset.target
        if (target) navigateRef.current(target)
      }
    }
    container.addEventListener('click', handler as EventListener, true)
    return () => container.removeEventListener('click', handler as EventListener, true)
  }, [editor])

  const typeEntryMap = useMemo(() => buildTypeEntryMap(entries), [entries])

  const baseItems = useMemo(
    () => deduplicateByPath(entries.map(entry => ({
      title: entry.title,
      aliases: [...new Set([entry.filename.replace(/\.md$/, ''), ...entry.aliases])],
      group: entry.isA || 'Note',
      entryTitle: entry.title,
      path: entry.path,
    }))),
    [entries]
  )

  const insertWikilink = useCallback((target: string) => {
    editor.insertInlineContent([
      { type: 'wikilink' as const, props: { target } },
      " ",
    ])
  }, [editor])

  const getWikilinkItems = useCallback(async (query: string): Promise<WikilinkSuggestionItem[]> => {
    if (query.length < MIN_QUERY_LENGTH) return []
    const candidates = preFilterWikilinks(baseItems, query)
    const items = attachClickHandlers(candidates, insertWikilink)
    return enrichSuggestionItems(items, query, typeEntryMap)
  }, [baseItems, insertWikilink, typeEntryMap])

  const getPersonMentionItems = useCallback(async (query: string): Promise<WikilinkSuggestionItem[]> => {
    if (query.length < PERSON_MENTION_MIN_QUERY) return []
    const candidates = filterPersonMentions(baseItems, query)
    const items = attachClickHandlers(candidates, insertWikilink)
    return enrichSuggestionItems(items, query, typeEntryMap)
  }, [baseItems, insertWikilink, typeEntryMap])

  return (
    <div ref={containerRef} className={`editor__blocknote-container${isDragOver ? ' editor__blocknote-container--drag-over' : ''}`} style={cssVars as React.CSSProperties}>
      {isDragOver && (
        <div className="editor__drop-overlay">
          <div className="editor__drop-overlay-label">Drop image here</div>
        </div>
      )}
      <BlockNoteView
        editor={editor}
        theme={isDarkTheme ? 'dark' : 'light'}
        onChange={onChange}
        editable={editable}
      >
        <SuggestionMenuController
          triggerCharacter="[["
          getItems={getWikilinkItems}
          suggestionMenuComponent={WikilinkSuggestionMenu}
          onItemClick={(item: WikilinkSuggestionItem) => item.onItemClick()}
        />
        <SuggestionMenuController
          triggerCharacter="@"
          getItems={getPersonMentionItems}
          suggestionMenuComponent={WikilinkSuggestionMenu}
          onItemClick={(item: WikilinkSuggestionItem) => item.onItemClick()}
        />
      </BlockNoteView>
    </div>
  )
}
