import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { VaultEntry } from '../types'
import { useRichEditorContentReadiness } from './useRichEditorSheetTransition'

function makeTab(path: string, content: string) {
  return {
    entry: {
      path,
      filename: path,
      title: 'Fresh Title',
    } as VaultEntry,
    content,
  }
}

describe('useRichEditorContentReadiness untitled rename continuity', () => {
  it('keeps the editor mounted while its untitled path catches up to the auto-renamed tab', () => {
    const content = '---\ntitle: Fresh Title\n---\n\n# Fresh Title\n\nBody typed live'
    const untitledTab = makeTab('untitled-note-123.md', content)
    const renamedTab = makeTab('fresh-title.md', content)

    const { result, rerender } = renderHook(
      ({ activeTab, editorContentPath }) => useRichEditorContentReadiness({
        activeTab,
        activeTabIsSheet: false,
        editorContentPath,
      }),
      {
        initialProps: {
          activeTab: untitledTab as typeof untitledTab | null,
          editorContentPath: untitledTab.entry.path,
        },
      },
    )

    expect(result.current).toBe(true)

    rerender({
      activeTab: null,
      editorContentPath: untitledTab.entry.path,
    })

    expect(result.current).toBe(true)

    rerender({
      activeTab: renamedTab,
      editorContentPath: untitledTab.entry.path,
    })

    expect(result.current).toBe(true)
  })

  it('waits for the editor on unrelated path changes', () => {
    const activeTab = makeTab('another-note.md', '# Destination')
    const { result } = renderHook(() => useRichEditorContentReadiness({
      activeTab,
      activeTabIsSheet: false,
      editorContentPath: 'untitled-note-123.md',
    }))

    expect(result.current).toBe(false)
  })

  it('keeps focused title editing ready when a delayed signal names the previous note', () => {
    const editorSurface = document.createElement('div')
    const editorInput = document.createElement('button')
    editorSurface.className = 'editor__blocknote-container'
    editorSurface.append(editorInput)
    document.body.append(editorSurface)

    const activeTab = makeTab('fresh-title.md', '# Fresh Title')
    const { result } = renderHook(() => useRichEditorContentReadiness({
      activeTab,
      activeTabIsSheet: false,
      editorContentPath: 'previous-note.md',
    }))

    act(() => editorInput.focus())
    expect(result.current).toBe(true)
    editorSurface.remove()
  })
})
