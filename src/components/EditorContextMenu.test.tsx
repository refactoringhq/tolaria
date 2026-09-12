import { act, render, waitFor } from '@testing-library/react'
import { useRef } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useEditorContextMenu } from './EditorContextMenu'
import { useCopyFullNoteCommand } from './useCopyFullNoteCommand'

vi.mock('../lib/telemetry', () => ({
  trackEvent: vi.fn(),
}))

vi.mock('./editorFullNoteCopy', () => ({
  copyFullNoteToClipboard: vi.fn(async () => true),
  pasteClipboardIntoEditor: vi.fn(async () => 'html' as const),
}))

vi.mock('../utils/plainTextPaste', () => ({
  requestPlainTextPaste: vi.fn(async () => true),
}))

import { copyFullNoteToClipboard, pasteClipboardIntoEditor } from './editorFullNoteCopy'
import { requestPlainTextPaste } from '../utils/plainTextPaste'

type ContextMenuConfig = Parameters<typeof useEditorContextMenu>[0]

function createEditor(): ContextMenuConfig['editor'] {
  return {
    focus: vi.fn(),
    _tiptapEditor: {
      commands: {
        selectAll: vi.fn(() => true),
      },
    },
  } as unknown as ContextMenuConfig['editor']
}

function MenuHtmlHarness({ editable = true }: { editable?: boolean }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const { handleEditorContextMenu, menuNode } = useEditorContextMenu({
    containerRef,
    editable,
    editor: createEditor(),
    locale: 'en',
  })
  return (
    <div ref={containerRef} data-testid="editor-container">
      <button
        type="button"
        data-testid="menu-trigger"
        onClick={handleEditorContextMenu as unknown as React.MouseEventHandler<HTMLButtonElement>}
      >
        open
      </button>
      {menuNode}
    </div>
  )
}

function openHtmlMenu(): HTMLElement {
  const trigger = document.querySelector('[data-testid="menu-trigger"]')
  expect(trigger).not.toBeNull()
  act(() => {
    trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 120, clientY: 140 }))
  })
  const menu = document.querySelector('[data-testid="editor-context-menu"]')
  expect(menu).not.toBeNull()
  return menu as HTMLElement
}

function findMenuItem(menu: HTMLElement, label: string): HTMLButtonElement | undefined {
  return Array.from(menu.querySelectorAll('button'))
    .find((button) => button.textContent === label)
}

function restoreClipboardStub(): void {
  Reflect.deleteProperty(navigator, 'clipboard')
}

describe('useEditorContextMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    restoreClipboardStub()
  })

  it('opens the menu on right click and closes on outside mousedown', () => {
    render(<MenuHtmlHarness />)
    openHtmlMenu()

    act(() => {
      document.dispatchEvent(new MouseEvent('mousedown'))
    })
    expect(document.querySelector('[data-testid="editor-context-menu"]')).toBeNull()
  })

  it('does not open when the editor is read-only', () => {
    render(<MenuHtmlHarness editable={false} />)
    const trigger = document.querySelector('[data-testid="menu-trigger"]')
    act(() => {
      trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 10, clientY: 10 }))
    })
    expect(document.querySelector('[data-testid="editor-context-menu"]')).toBeNull()
  })

  it('shows the copy item only when a selection is alive inside the editor', () => {
    const { container } = render(<MenuHtmlHarness />)
    const hostHtml = container.querySelector('[data-testid="editor-container"]') as HTMLElement
    const paragraph = document.createElement('p')
    paragraph.textContent = 'selected text'
    hostHtml.appendChild(paragraph)

    const range = document.createRange()
    range.selectNodeContents(paragraph)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)

    const menu = openHtmlMenu()
    expect(findMenuItem(menu, 'Copy')).toBeDefined()

    selection?.removeAllRanges()
  })

  it('pastes clipboard html into the editor from the menu action', async () => {
    vi.mocked(pasteClipboardIntoEditor).mockResolvedValueOnce('html')
    render(<MenuHtmlHarness />)
    const menu = openHtmlMenu()
    const pasteButton = findMenuItem(menu, 'Paste')
    expect(pasteButton).toBeDefined()

    await act(async () => {
      pasteButton?.click()
    })

    await waitFor(() => {
      expect(pasteClipboardIntoEditor).toHaveBeenCalledWith(expect.anything())
    })
    restoreClipboardStub()
  })

  it('falls back to plain-text paste when clipboard read is unavailable', async () => {
    vi.mocked(pasteClipboardIntoEditor).mockResolvedValueOnce(null)
    render(<MenuHtmlHarness />)
    const menu = openHtmlMenu()
    const pasteButton = findMenuItem(menu, 'Paste')
    expect(pasteButton).toBeDefined()

    await act(async () => {
      pasteButton?.click()
    })

    await waitFor(() => {
      expect(requestPlainTextPaste).toHaveBeenCalled()
    })
  })
})

describe('useCopyFullNoteCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('registers a bridge that copies the full note through the editor', async () => {
    const editor = createEditor() as unknown as Parameters<typeof useCopyFullNoteCommand>[0]['editor']
    const copyFullNoteRef: { current: (() => void) | null } = { current: null }

    function CommandHarness() {
      useCopyFullNoteCommand({
        activeTab: { entry: { fileKind: 'markdown', path: 'Note.md' } } as Parameters<typeof useCopyFullNoteCommand>[0]['activeTab'],
        copyFullNoteRef,
        editor,
        rawMode: false,
      })
      return null
    }

    render(<CommandHarness />)
    expect(copyFullNoteRef.current).not.toBeNull()

    await act(async () => {
      copyFullNoteRef.current?.()
    })

    await waitFor(() => {
      expect(copyFullNoteToClipboard).toHaveBeenCalledWith(editor)
    })
  })

  it('skips the copy when the note is not rich-text editable', () => {
    const editor = createEditor() as unknown as Parameters<typeof useCopyFullNoteCommand>[0]['editor']
    const copyFullNoteRef: { current: (() => void) | null } = { current: null }

    function CommandHarness() {
      useCopyFullNoteCommand({
        activeTab: null,
        copyFullNoteRef,
        editor,
        rawMode: false,
      })
      return null
    }

    render(<CommandHarness />)

    act(() => {
      copyFullNoteRef.current?.()
    })

    expect(copyFullNoteToClipboard).not.toHaveBeenCalled()
  })
})
