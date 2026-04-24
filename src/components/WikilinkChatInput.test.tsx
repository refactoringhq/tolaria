import { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { WikilinkChatInput } from './WikilinkChatInput'
import { UNSUPPORTED_INLINE_PASTE_MESSAGE } from './InlineWikilinkInput'
import type { VaultEntry } from '../types'

const makeEntry = (overrides: Partial<VaultEntry> = {}): VaultEntry => ({
  path: '/vault/note/test.md',
  filename: 'test.md',
  title: 'Test Note',
  isA: 'Note',
  aliases: [],
  belongsTo: [],
  relatedTo: [],
  status: null,
  owner: null,
  cadence: null,
  archived: false,
  modifiedAt: 1700000000,
  createdAt: 1700000000,
  fileSize: 100,
  snippet: '',
  wordCount: 0,
  relationships: {},
  icon: null,
  color: null,
  order: null,
  outgoingLinks: [],
  ...overrides,
})

const entries: VaultEntry[] = [
  makeEntry({ path: '/vault/alpha.md', title: 'Alpha', filename: 'alpha.md', isA: 'Project' }),
  makeEntry({ path: '/vault/beta.md', title: 'Beta', filename: 'beta.md', isA: 'Person', aliases: ['BLT'] }),
  makeEntry({ path: '/vault/gamma.md', title: 'Gamma', filename: 'gamma.md' }),
]

function Controlled({
  onSend,
  onUnsupportedPaste,
  disabled = false,
  placeholder,
}: {
  onSend?: (text: string, refs: Array<{ title: string; path: string; type: string | null }>) => void
  onUnsupportedPaste?: (message: string) => void
  disabled?: boolean
  placeholder?: string
}) {
  const [value, setValue] = useState('')

  return (
    <WikilinkChatInput
      entries={entries}
      value={value}
      onChange={setValue}
      onSend={onSend ?? vi.fn()}
      onUnsupportedPaste={onUnsupportedPaste}
      disabled={disabled}
      placeholder={placeholder}
    />
  )
}

function setSelection(editor: HTMLElement, offset: number) {
  const selection = window.getSelection()
  if (!selection) return

  const targetNode = editor.firstChild ?? editor
  const safeOffset = targetNode.nodeType === Node.TEXT_NODE
    ? Math.min(offset, targetNode.textContent?.length ?? 0)
    : Math.min(offset, targetNode.childNodes.length)

  const range = document.createRange()
  range.setStart(targetNode, safeOffset)
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)
}

function updateEditorText(text: string) {
  const editor = screen.getByTestId('agent-input')
  fireEvent.focus(editor)
  editor.textContent = text
  setSelection(editor, text.length)
  fireEvent.input(editor)
}

function clickFirstSuggestion() {
  const rows = screen.getByTestId('wikilink-menu').querySelectorAll('[class*="cursor-pointer"]')
  expect(rows.length).toBeGreaterThan(0)
  fireEvent.click(rows[0])
}

describe('WikilinkChatInput', () => {
  it('renders the placeholder overlay for an empty draft', () => {
    render(<Controlled placeholder="Ask something..." />)
    expect(screen.getByText('Ask something...')).toBeInTheDocument()
    expect(screen.getByTestId('agent-input')).toHaveAttribute('aria-placeholder', 'Ask something...')
  })

  it('calls onChange when the draft changes', () => {
    const onChange = vi.fn()
    render(
      <WikilinkChatInput entries={entries} value="" onChange={onChange} onSend={vi.fn()} />,
    )

    updateEditorText('hello')
    expect(onChange).toHaveBeenCalledWith('hello')
  })

  it('shows wikilink suggestions after typing [[', () => {
    render(<Controlled />)
    updateEditorText('[[a')

    const menu = screen.getByTestId('wikilink-menu')
    expect(menu.textContent).toContain('Alpha')
  })

  it('matches suggestions by alias', () => {
    render(<Controlled />)
    updateEditorText('[[BLT')

    expect(screen.getByTestId('wikilink-menu').textContent).toContain('Beta')
  })

  it('renders selected wikilinks inline instead of in a separate pill strip', () => {
    render(<Controlled />)
    updateEditorText('edit my [[alp')
    clickFirstSuggestion()

    expect(screen.queryByTestId('reference-pill')).toBeNull()
    expect(screen.getByTestId('inline-wikilink-chip')).toBeInTheDocument()
    expect(screen.getByTestId('agent-input').textContent).toContain('Alpha')
  })

  it('selects a suggestion with Enter before sending the draft', () => {
    const onSend = vi.fn()
    render(<Controlled onSend={onSend} />)
    updateEditorText('edit my [[alp')

    fireEvent.keyDown(screen.getByTestId('agent-input'), { key: 'Enter' })

    expect(screen.getByTestId('inline-wikilink-chip')).toBeInTheDocument()
    expect(onSend).not.toHaveBeenCalled()
  })

  it('deletes an inline chip with a single Backspace', () => {
    render(<Controlled />)
    updateEditorText('edit my [[alp')
    clickFirstSuggestion()

    const editor = screen.getByTestId('agent-input')
    fireEvent.keyDown(editor, { key: 'Backspace' })

    expect(screen.queryByTestId('inline-wikilink-chip')).toBeNull()
  })

  it('submits serialized wikilink text and resolved references', () => {
    const onSend = vi.fn()
    render(<Controlled onSend={onSend} />)

    updateEditorText('edit my [[alpha]] essay')
    fireEvent.keyDown(screen.getByTestId('agent-input'), { key: 'Enter' })

    expect(onSend).toHaveBeenCalledWith('edit my [[alpha]] essay', [
      { title: 'Alpha', path: '/vault/alpha.md', type: 'Project' },
    ])
  })

  it('does not send on Shift+Enter', () => {
    const onSend = vi.fn()
    render(<Controlled onSend={onSend} />)

    updateEditorText('hello')
    fireEvent.keyDown(screen.getByTestId('agent-input'), { key: 'Enter', shiftKey: true })

    expect(onSend).not.toHaveBeenCalled()
  })

  it('marks the editor disabled when disabled is true', () => {
    render(<Controlled disabled />)

    const editor = screen.getByTestId('agent-input')
    expect(editor).toHaveAttribute('contenteditable', 'false')
    expect(editor).toHaveAttribute('aria-disabled', 'true')
  })

  it('rejects pasted images without freezing the editor', () => {
    const onUnsupportedPaste = vi.fn()
    render(<Controlled onUnsupportedPaste={onUnsupportedPaste} />)

    const editor = screen.getByTestId('agent-input')
    const clipboardData = {
      getData: vi.fn(() => ''),
      files: [new File(['image'], 'paste.png', { type: 'image/png' })],
      items: [{ kind: 'file', type: 'image/png' }],
    }

    fireEvent.paste(editor, { clipboardData })

    expect(onUnsupportedPaste).toHaveBeenCalledWith(UNSUPPORTED_INLINE_PASTE_MESSAGE)

    updateEditorText('still works')
    expect(editor.textContent).toContain('still works')
  })

  it('recovers if unsupported media lands in the editor DOM', async () => {
    const onUnsupportedPaste = vi.fn()
    render(<Controlled onUnsupportedPaste={onUnsupportedPaste} />)

    const editor = screen.getByTestId('agent-input')
    editor.innerHTML = '<img alt="paste" src="data:image/png;base64,abc" />'

    fireEvent.input(editor)

    expect(onUnsupportedPaste).toHaveBeenCalledWith(UNSUPPORTED_INLINE_PASTE_MESSAGE)
    await waitFor(() => {
      expect(screen.getByTestId('agent-input').querySelector('img')).toBeNull()
    })

    updateEditorText('still works')
    expect(screen.getByTestId('agent-input').textContent).toContain('still works')
  })
})
