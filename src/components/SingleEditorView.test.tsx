import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import type { VaultEntry } from '../types'

const state = vi.hoisted(() => ({
  capturedToolbarProps: null as null | Record<string, unknown>,
  capturedSuggestionProps: {} as Record<string, Record<string, unknown>>,
  capturedImageDropArgs: null as null | Record<string, unknown>,
  capturedBlockNoteOnChange: null as null | (() => void),
  hoverGuardMock: vi.fn(),
  imageDropState: { isDragOver: false },
  linkActivationMock: vi.fn(),
  wikilinkEntriesRef: { current: [] as VaultEntry[] },
}))

vi.mock('@blocknote/react', () => ({
  ComponentsContext: {
    Provider: ({ children }: { children?: ReactNode }) => <>{children}</>,
  },
  BlockNoteViewRaw: (props: {
    children?: ReactNode
    editable?: boolean
    className?: string
    formattingToolbar?: boolean
    slashMenu?: boolean
    sideMenu?: boolean
    onChange?: () => void
  }) => {
    const {
      children,
      editable,
      className,
      formattingToolbar,
      slashMenu,
      sideMenu,
      ...restProps
    } = props
    state.capturedBlockNoteOnChange = props.onChange ?? null
    void formattingToolbar
    void slashMenu
    void sideMenu

    return (
      <div
        data-testid="blocknote-view"
        data-editable={editable !== false ? 'true' : 'false'}
        className={className}
        {...restProps}
      >
        {children}
      </div>
    )
  },
  SideMenuController: () => <div data-testid="side-menu-controller" />,
  SuggestionMenuController: (props: Record<string, unknown>) => {
    state.capturedSuggestionProps[String(props.triggerCharacter)] = props
    return <div data-testid={`suggestion-${String(props.triggerCharacter)}`} />
  },
  useCreateBlockNote: vi.fn(),
}))

vi.mock('@blocknote/mantine', () => ({
  components: {},
}))

vi.mock('@mantine/core', async () => {
  const React = await vi.importActual<typeof import('react')>('react')
  return {
    MantineContext: React.createContext(null),
    MantineProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
  }
})

vi.mock('../hooks/useTheme', () => ({
  useEditorTheme: () => ({ cssVars: { '--editor-accent': '#abc' } }),
}))

vi.mock('../hooks/useImageDrop', () => ({
  useImageDrop: (args: Record<string, unknown>) => {
    state.capturedImageDropArgs = args
    return state.imageDropState
  },
}))

vi.mock('../utils/typeColors', () => ({
  buildTypeEntryMap: () => ({}),
}))

vi.mock('../utils/wikilinkSuggestions', () => ({
  MIN_QUERY_LENGTH: 2,
  deduplicateByPath: <T,>(items: T[]) => items,
  preFilterWikilinks: () => [],
}))

vi.mock('../utils/personMentionSuggestions', () => ({
  PERSON_MENTION_MIN_QUERY: 1,
  filterPersonMentions: () => [],
}))

vi.mock('../utils/suggestionEnrichment', () => ({
  attachClickHandlers: <T,>(items: T[]) => items,
  enrichSuggestionItems: <T,>(items: T[]) => items,
}))

vi.mock('./WikilinkSuggestionMenu', () => ({
  WikilinkSuggestionMenu: () => <div data-testid="wikilink-suggestion-menu" />,
}))

vi.mock('./editorSchema', () => ({
  _wikilinkEntriesRef: state.wikilinkEntriesRef,
}))

vi.mock('./blockNoteSideMenuHoverGuard', () => ({
  useBlockNoteSideMenuHoverGuard: (containerRef: unknown) => state.hoverGuardMock(containerRef),
}))

vi.mock('./tolariaEditorFormattingConfig', () => ({
  getTolariaSlashMenuItems: vi.fn(async () => []),
}))

vi.mock('./tolariaEditorFormatting', () => ({
  TolariaFormattingToolbar: () => <div data-testid="tolaria-formatting-toolbar" />,
  TolariaFormattingToolbarController: (props: Record<string, unknown>) => {
    state.capturedToolbarProps = props
    return <div data-testid="tolaria-formatting-toolbar-controller" />
  },
}))

vi.mock('./tolariaBlockNoteSideMenu', () => ({
  TolariaSideMenu: () => <div data-testid="tolaria-side-menu" />,
}))

vi.mock('./useEditorLinkActivation', () => ({
  useEditorLinkActivation: (containerRef: unknown, onNavigateWikilink: unknown) => (
    state.linkActivationMock(containerRef, onNavigateWikilink)
  ),
}))

import { SingleEditorView } from './SingleEditorView'

function makeEntry(overrides: Partial<VaultEntry> = {}): VaultEntry {
  return {
    path: '/vault/project/alpha.md',
    filename: 'alpha.md',
    title: 'Alpha',
    isA: 'Project',
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: 'Active',
    archived: false,
    modifiedAt: 1,
    createdAt: 1,
    fileSize: 10,
    snippet: '',
    wordCount: 0,
    relationships: {},
    icon: null,
    color: null,
    order: null,
    sidebarLabel: null,
    template: null,
    sort: null,
    view: null,
    visible: null,
    organized: false,
    favorite: false,
    favoriteIndex: null,
    listPropertiesDisplay: [],
    outgoingLinks: [],
    properties: {},
    hasH1: true,
    fileKind: 'markdown',
    ...overrides,
  }
}

function createEditor() {
  const cursorBlock = { id: 'cursor-block', type: 'paragraph', content: [], children: [] }
  return {
    document: [
      { id: 'heading-block', type: 'heading', content: [], children: [] },
      cursorBlock,
    ],
    tryParseMarkdownToBlocks: vi.fn(async () => [
      { type: 'table', content: { type: 'tableContent' } },
    ]),
    blocksToHTMLLossy: vi.fn(() => '<table>seeded</table>'),
    _tiptapEditor: { commands: { setContent: vi.fn() } },
    focus: vi.fn(),
    getTextCursorPosition: vi.fn(() => ({ block: cursorBlock })),
    insertBlocks: vi.fn(),
    insertInlineContent: vi.fn(),
    setTextCursorPosition: vi.fn(),
  }
}

describe('SingleEditorView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.capturedToolbarProps = null
    state.capturedSuggestionProps = {}
    state.capturedImageDropArgs = null
    state.capturedBlockNoteOnChange = null
    state.imageDropState.isDragOver = false
    state.wikilinkEntriesRef.current = []
    delete window.__laputaTest
  })

  it('registers the seeded BlockNote test bridge, applies column widths, and cleans it up on unmount', async () => {
    const editor = createEditor()
    const entries = [makeEntry()]
    const { unmount } = render(
      <SingleEditorView
        editor={editor as never}
        entries={entries}
        onNavigateWikilink={vi.fn()}
      />,
    )

    expect(state.wikilinkEntriesRef.current).toEqual(entries)
    expect(typeof window.__laputaTest?.seedBlockNoteTable).toBe('function')

    await act(async () => {
      await window.__laputaTest?.seedBlockNoteTable?.([120, null, 80])
    })

    expect(editor.blocksToHTMLLossy).toHaveBeenCalledWith([
      expect.objectContaining({
        type: 'table',
        content: expect.objectContaining({
          type: 'tableContent',
          columnWidths: [120, null, 80],
        }),
      }),
      expect.objectContaining({ type: 'paragraph' }),
    ])
    expect(editor._tiptapEditor.commands.setContent).toHaveBeenCalledWith('<table>seeded</table>')
    expect(editor.focus).toHaveBeenCalled()

    unmount()

    expect(window.__laputaTest?.seedBlockNoteTable).toBeUndefined()
  })

  it('shows the drag overlay and inserts dropped images after the active cursor block', () => {
    state.imageDropState.isDragOver = true
    const editor = createEditor()

    render(
      <SingleEditorView
        editor={editor as never}
        entries={[makeEntry()]}
        onNavigateWikilink={vi.fn()}
        vaultPath="/vault"
      />,
    )

    expect(screen.getByText('Drop image here')).toBeInTheDocument()

    act(() => {
      (state.capturedImageDropArgs?.onImageUrl as (url: string) => void)('https://example.com/image.png')
    })

    expect(editor.insertBlocks).toHaveBeenCalledWith(
      [{ type: 'image', props: { url: 'https://example.com/image.png' } }],
      expect.objectContaining({ id: 'cursor-block' }),
      'after',
    )
  })

  it('wires the toolbar mouse guard and suggestion item click handlers', () => {
    const editor = createEditor()
    render(
      <SingleEditorView
        editor={editor as never}
        entries={[makeEntry()]}
        onNavigateWikilink={vi.fn()}
      />,
    )

    expect(state.hoverGuardMock).toHaveBeenCalledOnce()
    expect(state.linkActivationMock).toHaveBeenCalledOnce()

    const onMouseDownCapture = (
      (state.capturedToolbarProps?.floatingUIOptions as { elementProps: { onMouseDownCapture: (event: { target: HTMLElement; preventDefault: () => void }) => void } })
    ).elementProps.onMouseDownCapture
    const menuTrigger = document.createElement('button')
    menuTrigger.setAttribute('aria-haspopup', 'menu')
    const menuPreventDefault = vi.fn()
    onMouseDownCapture({ target: menuTrigger, preventDefault: menuPreventDefault })
    expect(menuPreventDefault).not.toHaveBeenCalled()

    const normalTarget = document.createElement('div')
    const normalPreventDefault = vi.fn()
    onMouseDownCapture({ target: normalTarget, preventDefault: normalPreventDefault })
    expect(normalPreventDefault).toHaveBeenCalledOnce()

    const onWikiItemClick = vi.fn()
    const onMentionItemClick = vi.fn()
    ;(state.capturedSuggestionProps['[['].onItemClick as (item: { onItemClick: () => void }) => void)({ onItemClick: onWikiItemClick })
    ;(state.capturedSuggestionProps['@'].onItemClick as (item: { onItemClick: () => void }) => void)({ onItemClick: onMentionItemClick })

    expect(onWikiItemClick).toHaveBeenCalledOnce()
    expect(onMentionItemClick).toHaveBeenCalledOnce()
  })

  it('defers rich-editor change propagation until IME composition ends', async () => {
    const editor = createEditor()
    const onChange = vi.fn()

    render(
      <SingleEditorView
        editor={editor as never}
        entries={[makeEntry()]}
        onNavigateWikilink={vi.fn()}
        onChange={onChange}
      />,
    )

    const blockNoteView = screen.getByTestId('blocknote-view')

    fireEvent.compositionStart(blockNoteView)
    act(() => {
      state.capturedBlockNoteOnChange?.()
    })
    expect(onChange).not.toHaveBeenCalled()

    fireEvent.compositionEnd(blockNoteView)
    await act(async () => {
      await Promise.resolve()
    })

    expect(onChange).toHaveBeenCalledTimes(1)
  })
})
