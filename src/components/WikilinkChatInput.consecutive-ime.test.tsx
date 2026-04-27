import { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { WikilinkChatInput } from './WikilinkChatInput'
import type { VaultEntry } from '../types'

const entries: VaultEntry[] = []

function Controlled({
  onDraftChange,
}: {
  onDraftChange?: (value: string) => void
}) {
  const [value, setValue] = useState('')
  return (
    <WikilinkChatInput
      entries={entries}
      value={value}
      onChange={(next) => {
        onDraftChange?.(next)
        setValue(next)
      }}
      onSend={vi.fn()}
    />
  )
}

describe('WikilinkChatInput — consecutive IME compositions', () => {
  it('does not duplicate syllables across two consecutive compositions', async () => {
    const onDraftChange = vi.fn()
    render(<Controlled onDraftChange={onDraftChange} />)

    const editor1 = screen.getByTestId('agent-input') as HTMLDivElement
    editor1.focus()

    // Syllable 1: 안 (IME injects plain text node directly into editor)
    fireEvent.compositionStart(editor1)
    editor1.appendChild(document.createTextNode('안'))
    fireEvent.input(editor1)
    fireEvent.compositionEnd(editor1)

    await waitFor(() => {
      expect(onDraftChange).toHaveBeenLastCalledWith('안')
    })

    // Re-query: forceRender may have remounted the editor
    const editor2 = screen.getByTestId('agent-input') as HTMLDivElement

    // Syllable 2: 녕 — IME again injects a sibling plain text node
    fireEvent.compositionStart(editor2)
    editor2.appendChild(document.createTextNode('녕'))
    fireEvent.input(editor2)
    fireEvent.compositionEnd(editor2)

    await waitFor(() => {
      expect(onDraftChange).toHaveBeenLastCalledWith('안녕')
    })

    const editor3 = screen.getByTestId('agent-input') as HTMLDivElement
    // Bug symptom: would be "안안녕녕" if stray text nodes accumulate
    expect(editor3.textContent).toBe('안녕')
  })

  it('does not duplicate across three consecutive compositions', async () => {
    const onDraftChange = vi.fn()
    render(<Controlled onDraftChange={onDraftChange} />)

    const seq = ['안', '녕', '하']

    for (const syllable of seq) {
      const editor = screen.getByTestId('agent-input') as HTMLDivElement
      editor.focus()
      fireEvent.compositionStart(editor)
      editor.appendChild(document.createTextNode(syllable))
      fireEvent.input(editor)
      fireEvent.compositionEnd(editor)
    }

    await waitFor(() => {
      expect(onDraftChange).toHaveBeenLastCalledWith('안녕하')
    })

    const finalEditor = screen.getByTestId('agent-input') as HTMLDivElement
    expect(finalEditor.textContent).toBe('안녕하')
  })
})
