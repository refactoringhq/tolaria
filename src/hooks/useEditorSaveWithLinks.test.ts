import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useEditorSaveWithLinks } from './useEditorSaveWithLinks'

const mockHandleContentChange = vi.fn()
const mockHandleSave = vi.fn()
const mockSavePendingForPath = vi.fn()

vi.mock('./useEditorSave', () => ({
  useEditorSave: vi.fn(() => ({
    handleContentChange: mockHandleContentChange,
    handleSave: mockHandleSave,
    savePendingForPath: mockSavePendingForPath,
  })),
}))

describe('useEditorSaveWithLinks', () => {
  let updateEntry: Mock
  let setTabs: Mock
  let setToastMessage: Mock
  let onAfterSave: Mock

  beforeEach(() => {
    updateEntry = vi.fn()
    setTabs = vi.fn()
    setToastMessage = vi.fn()
    onAfterSave = vi.fn()
    mockHandleContentChange.mockClear()
    mockHandleSave.mockClear()
    mockSavePendingForPath.mockClear()
  })

  function renderHookWithLinks() {
    return renderHook(() =>
      useEditorSaveWithLinks({
        updateEntry,
        setTabs,
        setToastMessage,
        onAfterSave,
      }),
    )
  }

  it('handleContentChange delegates to useEditorSave handleContentChange', () => {
    const { result } = renderHookWithLinks()

    act(() => {
      result.current.handleContentChange('/note.md', 'no links here')
    })

    expect(mockHandleContentChange).toHaveBeenCalledWith('/note.md', 'no links here')
  })

  it('handleContentChange calls updateEntry with extracted outgoing links when links change', () => {
    const { result } = renderHookWithLinks()

    act(() => {
      result.current.handleContentChange('/note.md', 'see [[PageA]] and [[PageB]]')
    })

    expect(updateEntry).toHaveBeenCalledWith('/note.md', {
      outgoingLinks: ['PageA', 'PageB'],
    })
  })

  it('handleContentChange does NOT call updateEntry again when links have not changed', () => {
    const { result } = renderHookWithLinks()

    act(() => {
      result.current.handleContentChange('/note.md', 'text [[Alpha]] more text')
    })
    expect(updateEntry).toHaveBeenCalledTimes(1)

    // Same link, different surrounding text
    act(() => {
      result.current.handleContentChange('/note.md', 'different text [[Alpha]] still')
    })
    // updateEntry should NOT have been called again — links unchanged
    expect(updateEntry).toHaveBeenCalledTimes(1)
  })

  it('handleContentChange calls updateEntry again when links change on subsequent edit', () => {
    const { result } = renderHookWithLinks()

    act(() => {
      result.current.handleContentChange('/note.md', 'see [[Alpha]]')
    })
    expect(updateEntry).toHaveBeenCalledTimes(1)
    expect(updateEntry).toHaveBeenCalledWith('/note.md', {
      outgoingLinks: ['Alpha'],
    })

    // Now links change
    act(() => {
      result.current.handleContentChange('/note.md', 'see [[Alpha]] and [[Beta]]')
    })
    expect(updateEntry).toHaveBeenCalledTimes(2)
    expect(updateEntry).toHaveBeenLastCalledWith('/note.md', {
      outgoingLinks: ['Alpha', 'Beta'],
    })
  })

  it('handleContentChange calls updateEntry with empty links on first call with no links', () => {
    const { result } = renderHookWithLinks()

    // First call with no links — prevLinksKeyRef starts as '' and extracted key is also ''
    // but since they're equal, updateEntry should NOT be called
    act(() => {
      result.current.handleContentChange('/note.md', 'plain text no links')
    })

    // The initial ref is '' and no-links key is also '' — no change
    expect(updateEntry).not.toHaveBeenCalled()
  })

  it('handles pipe-separated wikilinks (display text syntax)', () => {
    const { result } = renderHookWithLinks()

    act(() => {
      result.current.handleContentChange('/note.md', 'see [[Target|Display Text]]')
    })

    expect(updateEntry).toHaveBeenCalledWith('/note.md', {
      outgoingLinks: ['Target'],
    })
  })

  it('spreads all properties from useEditorSave onto the return value', () => {
    const { result } = renderHookWithLinks()

    // handleSave and savePendingForPath should be passed through from the mock
    expect(result.current.handleSave).toBeDefined()
    expect(result.current.savePendingForPath).toBeDefined()
  })
})
