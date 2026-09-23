import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MutableRefObject } from 'react'

const {
  buildRawEditorAutocompleteStateMock,
  buildRawEditorBaseItemsMock,
  buildTypeEntryMapMock,
  detectYamlErrorMock,
  extractWikilinkQueryMock,
  getRawEditorDropdownPositionMock,
  noteSearchListState,
  replaceActiveWikilinkQueryMock,
  trackEventMock,
  useCodeMirrorMock,
  viewRefState,
} = vi.hoisted(() => ({
  buildRawEditorAutocompleteStateMock: vi.fn(),
  buildRawEditorBaseItemsMock: vi.fn(),
  buildTypeEntryMapMock: vi.fn(),
  detectYamlErrorMock: vi.fn(),
  extractWikilinkQueryMock: vi.fn(),
  getRawEditorDropdownPositionMock: vi.fn(),
  noteSearchListState: { lastProps: null as null | Record<string, unknown> },
  replaceActiveWikilinkQueryMock: vi.fn(),
  trackEventMock: vi.fn(),
  useCodeMirrorMock: vi.fn(),
  viewRefState: { current: null as null | Record<string, unknown> },
}))

vi.mock('../hooks/useCodeMirror', () => ({
  useCodeMirror: useCodeMirrorMock,
}))

vi.mock('../utils/rawEditorUtils', () => ({
  buildRawEditorAutocompleteState: buildRawEditorAutocompleteStateMock,
  buildRawEditorBaseItems: buildRawEditorBaseItemsMock,
  detectYamlError: detectYamlErrorMock,
  extractWikilinkQuery: extractWikilinkQueryMock,
  getRawEditorDropdownPosition: getRawEditorDropdownPositionMock,
  replaceActiveWikilinkQuery: replaceActiveWikilinkQueryMock,
}))

vi.mock('../utils/typeColors', () => ({
  buildTypeEntryMap: buildTypeEntryMapMock,
}))

vi.mock('../lib/telemetry', () => ({
  trackEvent: trackEventMock,
}))

vi.mock('./NoteSearchList', () => ({
  NoteSearchList: (props: {
    items: Array<{ title: string; onItemClick: () => void }>
    onItemClick: (item: { title: string; onItemClick: () => void }) => void
    onItemHover: (index: number) => void
    selectedIndex: number
  }) => {
    noteSearchListState.lastProps = props
    return (
      <div data-testid="note-search-list">
        {props.items.map((item, index) => (
          <button type="button"
            key={item.title}
            data-testid={`note-search-item-${index}`}
            onMouseEnter={() => props.onItemHover(index)}
            onClick={() => props.onItemClick(item)}
          >
            {item.title}
          </button>
        ))}
        <div data-testid="note-search-selected-index">{props.selectedIndex}</div>
      </div>
    )
  },
}))

import { RawEditorView } from './RawEditorView'
import { insertPlainTextFromClipboardText } from '../utils/plainTextPaste'

function entry(title: string, path = `/vault/note/${title}.md`) {
  return {
    path,
    filename: `${title}.md`,
    title,
    isA: 'Note',
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: null,
    owner: null,
    cadence: null,
    archived: false,
    modifiedAt: null,
    createdAt: null,
    fileSize: 0,
    snippet: '',
    wordCount: 0,
    relationships: {},
    icon: null,
    color: null,
    order: null,
    sidebarLabel: null,
    template: null,
    sort: null,
    outgoingLinks: [],
    properties: {},
  }
}

function createMockView(docText = '[[Target') {
  return {
    state: {
      doc: { toString: () => docText },
      selection: { main: { head: docText.length } },
      replaceSelection: vi.fn((text: string) => ({
        changes: { from: 2, to: 5, insert: text },
        selection: { anchor: 2 + text.length },
      })),
    },
    dispatch: vi.fn(),
    focus: vi.fn(),
  }
}

function latestCodeMirrorCallbacks<T>(): T {
  const callbacks = useCodeMirrorMock.mock.calls.at(-1)?.[2]
  if (!callbacks) throw new Error('CodeMirror callbacks were not registered')
  return callbacks as T
}

describe('RawEditorView behavior coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    noteSearchListState.lastProps = null
    viewRefState.current = createMockView()
    useCodeMirrorMock.mockImplementation(() => viewRefState)
    buildRawEditorBaseItemsMock.mockReturnValue([{ title: 'Base item' }])
    buildTypeEntryMapMock.mockReturnValue({ Note: { title: 'Note' } })
    detectYamlErrorMock.mockImplementation((doc: string) => (
      doc.includes('broken') ? 'Broken YAML' : null
    ))
    extractWikilinkQueryMock.mockReturnValue(null)
    getRawEditorDropdownPositionMock.mockReturnValue({ top: 12, left: 34 })
    replaceActiveWikilinkQueryMock.mockReturnValue({
      text: '[[Inserted]]',
      cursor: 12,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('debounces content changes, exposes the latest content ref, flushes saves, and cleans up on unmount', () => {
    const onContentChange = vi.fn()
    const onSave = vi.fn()
    const latestContentRef = { current: null } as MutableRefObject<string | null>

    const { rerender, unmount } = render(
      <RawEditorView
        content="---\ntitle: Start\n---"
        path="/vault/a.md"
        entries={[entry('Alpha')]}
        onContentChange={onContentChange}
        onSave={onSave}
        latestContentRef={latestContentRef}
      />,
    )

    const callbacks = latestCodeMirrorCallbacks<{
      onDocChange: (doc: string) => void
      onSave: () => void
    }>()

    act(() => {
      callbacks.onDocChange('broken content')
    })

    expect(latestContentRef.current).toBe('broken content')
    expect(screen.getByTestId('raw-editor-yaml-error')).toHaveTextContent('Broken YAML')

    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(onContentChange).toHaveBeenCalledWith('/vault/a.md', 'broken content')

    rerender(
      <RawEditorView
        content="fixed"
        path="/vault/b.md"
        entries={[entry('Alpha')]}
        onContentChange={onContentChange}
        onSave={onSave}
        latestContentRef={latestContentRef}
      />,
    )

    act(() => {
      callbacks.onDocChange('pending change')
      callbacks.onSave()
    })

    expect(onContentChange).toHaveBeenLastCalledWith('/vault/b.md', 'pending change')
    expect(onSave).toHaveBeenCalledTimes(1)

    act(() => {
      callbacks.onDocChange('flush on unmount')
    })
    unmount()

    expect(onContentChange).toHaveBeenLastCalledWith('/vault/b.md', 'flush on unmount')
  })

  it('opens the autocomplete dropdown, updates selection, inserts wikilinks, and tracks the insert event', () => {
    extractWikilinkQueryMock.mockReturnValue('alp')
    buildRawEditorAutocompleteStateMock.mockImplementation(({ onInsertTarget }: { onInsertTarget: (target: string) => void }) => ({
      items: [
        { title: 'Alpha', path: '/vault/alpha.md', onItemClick: () => onInsertTarget('Alpha') },
        { title: 'Beta', path: '/vault/beta.md', onItemClick: () => onInsertTarget('Beta') },
      ],
      selectedIndex: 0,
    }))
    const onContentChange = vi.fn()
    const mockView = createMockView('[[alp')
    viewRefState.current = mockView

    render(
      <RawEditorView
        content="[[alp"
        path="/vault/a.md"
        entries={[entry('Alpha'), entry('Beta')]}
        onContentChange={onContentChange}
        onSave={vi.fn()}
        vaultPath="/vault"
      />,
    )

    let callbacks = latestCodeMirrorCallbacks<{
      onCursorActivity: (view: unknown) => void
      onEscape: () => boolean
      onSuggestionKey?: (key: string) => boolean
    }>()

    act(() => {
      callbacks.onCursorActivity(mockView)
    })
    callbacks = latestCodeMirrorCallbacks<typeof callbacks>()

    expect(buildRawEditorAutocompleteStateMock).toHaveBeenCalledWith(expect.objectContaining({
      query: 'alp',
      vaultPath: '/vault',
    }))
    expect(screen.getByTestId('raw-editor-wikilink-dropdown')).toBeInTheDocument()
    expect(screen.getByTestId('note-search-selected-index')).toHaveTextContent('0')

    let handled = false
    act(() => {
      handled = callbacks.onSuggestionKey?.('ArrowDown') ?? false
    })
    expect(handled).toBe(true)
    expect(screen.getByTestId('note-search-selected-index')).toHaveTextContent('1')
    callbacks = latestCodeMirrorCallbacks<typeof callbacks>()

    act(() => {
      handled = callbacks.onSuggestionKey?.('ArrowUp') ?? false
    })
    expect(handled).toBe(true)
    expect(screen.getByTestId('note-search-selected-index')).toHaveTextContent('0')

    fireEvent.mouseEnter(screen.getByTestId('note-search-item-1'))
    expect(screen.getByTestId('note-search-selected-index')).toHaveTextContent('1')
    callbacks = latestCodeMirrorCallbacks<typeof callbacks>()

    act(() => {
      handled = callbacks.onSuggestionKey?.('Enter') ?? false
    })
    expect(handled).toBe(true)

    expect(replaceActiveWikilinkQueryMock).toHaveBeenCalledWith('[[alp', '[[alp'.length, 'Beta')
    expect(mockView.dispatch).toHaveBeenCalledWith({
      changes: { from: 0, to: 5, insert: '[[Inserted]]' },
      selection: { anchor: 12 },
    })
    expect(onContentChange).toHaveBeenCalledWith('/vault/a.md', '[[Inserted]]')
    expect(trackEventMock).toHaveBeenCalledWith('wikilink_inserted')
    expect(mockView.focus).toHaveBeenCalledTimes(1)
    callbacks = latestCodeMirrorCallbacks<typeof callbacks>()
    expect(callbacks.onEscape()).toBe(false)
  })

  it('clears autocomplete when the query is too short and reports escape handling while open', () => {
    extractWikilinkQueryMock
      .mockReturnValueOnce('a')
      .mockReturnValueOnce('alpha')
    buildRawEditorAutocompleteStateMock.mockImplementation(({ onInsertTarget }: { onInsertTarget: (target: string) => void }) => ({
      items: [
        { title: 'Alpha', path: '/vault/alpha.md', onItemClick: () => onInsertTarget('Alpha') },
      ],
      selectedIndex: 0,
    }))
    const mockView = createMockView('[[alpha')
    viewRefState.current = mockView

    render(
      <RawEditorView
        content="[[alpha"
        path="/vault/a.md"
        entries={[entry('Alpha')]}
        onContentChange={vi.fn()}
        onSave={vi.fn()}
      />,
    )

    let callbacks = latestCodeMirrorCallbacks<{
      onCursorActivity: (view: unknown) => void
      onEscape: () => boolean
    }>()

    act(() => {
      callbacks.onCursorActivity(mockView)
    })

    expect(screen.queryByTestId('raw-editor-wikilink-dropdown')).not.toBeInTheDocument()

    callbacks = latestCodeMirrorCallbacks<typeof callbacks>()

    act(() => {
      callbacks.onCursorActivity(mockView)
    })

    expect(screen.getByTestId('raw-editor-wikilink-dropdown')).toBeInTheDocument()
    callbacks = latestCodeMirrorCallbacks<typeof callbacks>()
    expect(callbacks.onEscape()).toBe(true)
  })

  it('handles registered plain-text paste requests with CodeMirror selection replacement', () => {
    const mockView = createMockView('Alpha Beta')
    viewRefState.current = mockView

    render(
      <RawEditorView
        content="Alpha Beta"
        path="/vault/a.md"
        entries={[entry('Alpha')]}
        onContentChange={vi.fn()}
        onSave={vi.fn()}
      />,
    )

    fireEvent.focus(screen.getByTestId('raw-editor-codemirror'))

    expect(insertPlainTextFromClipboardText('Plain\nText')).toBe(true)
    expect(mockView.state.replaceSelection).toHaveBeenCalledWith('Plain\nText')
    expect(mockView.dispatch).toHaveBeenCalledWith({
      changes: { from: 2, to: 5, insert: 'Plain\nText' },
      selection: { anchor: 12 },
      userEvent: 'input.paste',
    })
    expect(mockView.focus).toHaveBeenCalledOnce()
  })

})
