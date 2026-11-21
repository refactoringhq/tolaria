import { useState } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { VaultEntry } from '../types'
import { WikilinkChatInput } from './WikilinkChatInput'

function ControlledComposer({ onDraftChange }: { onDraftChange: (value: string) => void }) {
  const [value, setValue] = useState('')
  const handleChange = (nextValue: string) => {
    onDraftChange(nextValue)
    setValue(nextValue)
  }

  return (
    <WikilinkChatInput
      entries={[] as VaultEntry[]}
      value={value}
      onChange={handleChange}
      onSend={vi.fn()}
      placeholder="Ask Tolaria"
    />
  )
}

interface TextBoundary {
  node: Node
  nodeOffset: number
}

function textBoundaryAt(editor: HTMLElement, offset: number): TextBoundary {
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT)
  let remaining = offset
  let node: Node | null = walker.nextNode()
  while (node !== null) {
    const length = node.textContent?.length ?? 0
    if (remaining <= length) return { node, nodeOffset: remaining }
    remaining -= length
    node = walker.nextNode()
  }
  return { node: editor, nodeOffset: 0 }
}

function setSelection(editor: HTMLElement, offset: number) {
  const { node, nodeOffset } = textBoundaryAt(editor, offset)
  const selection = window.getSelection()
  if (!selection) return
  const range = document.createRange()
  range.setStart(node, nodeOffset)
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)
}

function lateCompositionCommit(editor: HTMLElement, text: string) {
  const event = new Event('beforeinput', { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    data: { value: text.at(-1) },
    inputType: { value: 'insertText' },
    isComposing: { value: false },
  })
  fireEvent(editor, event)
  editor.textContent = text
  setSelection(editor, text.length)
  fireEvent.input(editor)
  return event
}

describe('InlineWikilinkInput hidden Sogou composition selection', () => {
  it('does not rewrite the DOM selection when the synced selection is unchanged', async () => {
    const onDraftChange = vi.fn()
    render(<ControlledComposer onDraftChange={onDraftChange} />)
    const editorEl = screen.getByTestId('agent-input')
    editorEl.focus()

    // Sogou's hidden composition (#1329) inserts text natively with no
    // composition events; the keyup selection sync must not destroy and
    // rebuild the native selection when it already matches, or the TSF
    // composition anchor dies and the candidate window closes.
    editorEl.replaceChildren(document.createTextNode('n'))
    setSelection(editorEl, 1)
    const removeSpy = vi.spyOn(window.getSelection() as Selection, 'removeAllRanges')
    fireEvent.keyUp(editorEl, { key: 'n' })

    await act(async () => Promise.resolve())

    expect(removeSpy).not.toHaveBeenCalled()
  })
})

describe('InlineWikilinkInput Korean IME settlement', () => {
  it('hides the placeholder while composing and restores it after cancellation', () => {
    render(<ControlledComposer onDraftChange={vi.fn()} />)
    const editor = screen.getByTestId('agent-input')
    const placeholder = screen.getByText('Ask Tolaria')

    expect(placeholder).not.toHaveAttribute('hidden')
    fireEvent.compositionStart(editor)
    expect(placeholder).toHaveAttribute('hidden')

    fireEvent.compositionEnd(editor)
    expect(placeholder).not.toHaveAttribute('hidden')
  })

  it('does not reconcile the composer before a late native commit reaches the original editor', async () => {
    const onDraftChange = vi.fn()
    render(<ControlledComposer onDraftChange={onDraftChange} />)
    const editor = screen.getByTestId('agent-input')

    editor.focus()
    fireEvent.compositionStart(editor)
    expect(screen.getByText('Ask Tolaria')).toHaveAttribute('hidden')
    editor.textContent = '안녕하세'
    setSelection(editor, '안녕하세'.length)
    fireEvent.input(editor)
    fireEvent.compositionEnd(editor)

    await act(async () => Promise.resolve())

    expect(screen.getByText('Ask Tolaria')).toHaveAttribute('hidden')
    expect(onDraftChange).not.toHaveBeenCalled()
    expect(screen.getByTestId('agent-input')).toBe(editor)

    const commitEvent = lateCompositionCommit(editor, '안녕하세요')

    expect(commitEvent.defaultPrevented).toBe(false)
    await waitFor(() => expect(onDraftChange).toHaveBeenLastCalledWith('안녕하세요'))
    expect(screen.getByTestId('agent-input').textContent).toBe('안녕하세요')
  })
})
