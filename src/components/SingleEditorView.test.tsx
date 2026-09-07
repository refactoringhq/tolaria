import {
  createEditor,
  getSingleEditorViewTestState,
  makeEntry,
  mockOpenExternalUrl,
  mockOpenLocalFile,
} from './SingleEditorView.testUtils'
import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VaultEntry } from '../types'
import { RUNTIME_STYLE_NONCE } from '../lib/runtimeStyleNonce'
import { SingleEditorView } from './SingleEditorView'
import { TooltipProvider } from './ui/tooltip'

const state = getSingleEditorViewTestState()

describe('SingleEditorView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.capturedLinkToolbarProps = null
    state.capturedToolbarProps = null
    state.capturedSuggestionProps = {}
    state.capturedImageDropArgs = null
    state.capturedBlockNoteOnChange = null
    state.capturedMantineGetStyleNonce = null
    state.blockNoteViewError = null
    state.blockNoteViewErrorOnce = false
    state.imageDropState.isDragOver = false
    state.wikilinkEntriesRef.current = []
    state.wikilinkCandidates = []
    mockOpenExternalUrl.mockClear()
    mockOpenLocalFile.mockClear()
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.classList.remove('dark')
    delete window.__laputaTest
  })

  it('repairs the live editor document before remounting after a stale missing-id block error', async () => {
    state.blockNoteViewError = new Error("Block doesn't have id")
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const editor = createEditor()
    editor.document = [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Recovered body', styles: {} }],
        children: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Recovered child', styles: {} }],
            children: [],
          },
        ],
      },
    ]

    try {
      render(
        <SingleEditorView
          editor={editor as never}
          entries={[makeEntry()]}
          onNavigateWikilink={vi.fn()}
        />,
        { wrapper: TooltipProvider, onRecoverableError: () => {} },
      )

      await waitFor(() => {
        expect(screen.getByTestId('blocknote-view')).toBeInTheDocument()
      })
      expect(screen.getByTestId('blocknote-view')).toHaveAttribute('data-editable', 'true')
      expect(editor.replaceBlocks).toHaveBeenCalledTimes(1)
      expect(editor.replaceBlocks.mock.calls[0][1]).toEqual([
        expect.objectContaining({
          id: expect.any(String),
          children: [],
        }),
        expect.objectContaining({
          id: expect.any(String),
          content: [{ type: 'text', text: 'Recovered child', styles: {} }],
          children: [],
        }),
      ])
    } finally {
      consoleError.mockRestore()
    }
  })

  it('remounts after a BlockNote table row index render error', async () => {
    state.blockNoteViewError = new RangeError(
      'Index 1 out of range for <tableRow(tableCell(tableParagraph("A")))>',
    )
    state.blockNoteViewErrorOnce = true
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const editor = createEditor()

    try {
      render(
        <SingleEditorView
          editor={editor as never}
          entries={[makeEntry()]}
          onNavigateWikilink={vi.fn()}
        />,
        { wrapper: TooltipProvider, onRecoverableError: () => {} },
      )

      await waitFor(() => {
        expect(screen.getByTestId('blocknote-view')).toBeInTheDocument()
      })
      expect(screen.getByTestId('blocknote-view')).toHaveAttribute('data-editable', 'true')
      expect(editor.replaceBlocks).not.toHaveBeenCalled()
    } finally {
      consoleError.mockRestore()
    }
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
    expect(screen.getByTestId('blocknote-view')).toHaveAttribute('data-link-toolbar', 'false')
    expect(state.capturedLinkToolbarProps).toEqual(expect.objectContaining({
      linkToolbar: expect.any(Function),
      floatingUIOptions: expect.objectContaining({
        elementProps: expect.objectContaining({
          onMouseDownCapture: expect.any(Function),
        }),
      }),
    }))

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

    const linkToolbarMouseDownCapture = (
      (state.capturedLinkToolbarProps?.floatingUIOptions as { elementProps: { onMouseDownCapture: (event: { target: HTMLElement; preventDefault: () => void }) => void } })
    ).elementProps.onMouseDownCapture
    const linkInput = document.createElement('input')
    const linkInputPreventDefault = vi.fn()
    linkToolbarMouseDownCapture({ target: linkInput, preventDefault: linkInputPreventDefault })
    expect(linkInputPreventDefault).not.toHaveBeenCalled()

    const linkActionTarget = document.createElement('button')
    const linkActionPreventDefault = vi.fn()
    linkToolbarMouseDownCapture({ target: linkActionTarget, preventDefault: linkActionPreventDefault })
    expect(linkActionPreventDefault).toHaveBeenCalledOnce()

    const onWikiItemClick = vi.fn()
    const onMentionItemClick = vi.fn()
    ;(state.capturedSuggestionProps['[['].onItemClick as (item: { onItemClick: () => void }) => void)({ onItemClick: onWikiItemClick })
    ;(state.capturedSuggestionProps['@'].onItemClick as (item: { onItemClick: () => void }) => void)({ onItemClick: onMentionItemClick })

    expect(onWikiItemClick).toHaveBeenCalledOnce()
    expect(onMentionItemClick).toHaveBeenCalledOnce()
  })

  it('renders when a reload returns an entry with missing suggestion metadata', () => {
    const reloadedEntry = {
      ...makeEntry({ path: '/vault/project/reloaded.md', title: 'Reloaded' }),
      filename: undefined,
      aliases: undefined,
      isA: undefined,
    } as unknown as VaultEntry

    expect(() => {
      render(
        <SingleEditorView
          editor={createEditor() as never}
          entries={[reloadedEntry]}
          onNavigateWikilink={vi.fn()}
        />,
      )
    }).not.toThrow()
  })

  it('ignores stale suggestion item clicks after the editor DOM disconnects', () => {
    const editor = createEditor()
    editor.domElement = document.createElement('div')

    render(
      <SingleEditorView
        editor={editor as never}
        entries={[makeEntry()]}
        onNavigateWikilink={vi.fn()}
      />,
    )

    const staleItemClick = vi.fn(() => {
      throw new TypeError('Cannot read properties of undefined (reading isConnected)')
    })

    expect(() => {
      ;(state.capturedSuggestionProps['[['].onItemClick as (item: { onItemClick: () => void }) => void)({
        onItemClick: staleItemClick,
      })
    }).not.toThrow()
    expect(staleItemClick).not.toHaveBeenCalled()
  })

  it('runs suggestion item clicks when BlockNote keeps the editor DOM outside the React container', () => {
    const editor = createEditor()
    editor.domElement = document.createElement('div')
    document.body.appendChild(editor.domElement)
    const itemClick = vi.fn()

    try {
      render(
        <SingleEditorView
          editor={editor as never}
          entries={[makeEntry()]}
          onNavigateWikilink={vi.fn()}
        />,
      )

      ;(state.capturedSuggestionProps['[['].onItemClick as (item: { onItemClick: () => void }) => void)({
        onItemClick: itemClick,
      })

      expect(itemClick).toHaveBeenCalledOnce()
    } finally {
      editor.domElement.remove()
    }
  })

  it('inserts the selected emoji from shortcode suggestions', async () => {
    const editor = createEditor()

    render(
      <SingleEditorView
        editor={editor as never}
        entries={[makeEntry()]}
        onNavigateWikilink={vi.fn()}
      />,
    )

    const getEmojiItems = state.capturedSuggestionProps[':'].getItems as (
      query: string
    ) => Promise<Array<{ id: string; name: string; onItemClick: () => void }>>

    const italyItems = await getEmojiItems(':it')
    expect(italyItems[0]).toMatchObject({ id: '🇮🇹' })
    expect(italyItems[0].name).toMatch(/italy/i)

    const items = await getEmojiItems(':rocket')
    const rocketItem = items.find(item => item.id === '🚀')

    expect(rocketItem).toMatchObject({ name: 'rocket' })
    rocketItem?.onItemClick()

    expect(editor.insertInlineContent).toHaveBeenCalledWith('🚀', { updateSelection: true })
  })

  it('guards stale click handlers stored on wikilink suggestion items', async () => {
    const editor = createEditor()
    editor.domElement = document.createElement('div')
    const staleItemClick = vi.fn(() => {
      throw new TypeError('Cannot read properties of undefined (reading isConnected)')
    })
    state.wikilinkCandidates = [{
      title: 'Alpha',
      path: '/vault/project/alpha.md',
      onItemClick: staleItemClick,
    }]

    render(
      <SingleEditorView
        editor={editor as never}
        entries={[makeEntry()]}
        onNavigateWikilink={vi.fn()}
      />,
    )

    const getItems = state.capturedSuggestionProps['[['].getItems as (
      query: string
    ) => Promise<Array<{ onItemClick: () => void }>>
    const items = await getItems('al')

    expect(items).toHaveLength(1)
    expect(() => items[0].onItemClick()).not.toThrow()
    expect(staleItemClick).not.toHaveBeenCalled()
  })

  it('passes the active document theme to BlockNote', () => {
    document.documentElement.setAttribute('data-theme', 'dark')
    document.documentElement.classList.add('dark')

    render(
      <SingleEditorView
        editor={createEditor() as never}
        entries={[makeEntry()]}
        onNavigateWikilink={vi.fn()}
      />,
    )

    expect(screen.getByTestId('blocknote-view')).toHaveAttribute('theme', 'dark')
    expect(screen.getByTestId('blocknote-view')).toHaveAttribute('data-mantine-color-scheme', 'dark')
  })

  it('passes the runtime CSP style nonce to Mantine fallback style tags', () => {
    render(
      <SingleEditorView
        editor={createEditor() as never}
        entries={[makeEntry()]}
        onNavigateWikilink={vi.fn()}
      />,
    )

    expect(state.capturedMantineGetStyleNonce?.()).toBe(RUNTIME_STYLE_NONCE)
  })

})
