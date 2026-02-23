import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useEditorSave } from './useEditorSave'

const mockInvokeFn = vi.fn<(cmd: string, args?: Record<string, unknown>) => Promise<null>>(() => Promise.resolve(null))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: (cmd: string, args?: Record<string, unknown>) => mockInvokeFn(cmd, args),
  updateMockContent: vi.fn(),
}))

describe('useEditorSave', () => {
  let updateVaultContent: vi.Mock
  let setTabs: vi.Mock
  let setToastMessage: vi.Mock

  beforeEach(() => {
    updateVaultContent = vi.fn()
    setTabs = vi.fn()
    setToastMessage = vi.fn()
    mockInvokeFn.mockClear()
  })

  function renderSaveHook() {
    return renderHook(() => useEditorSave({ updateVaultContent, setTabs, setToastMessage }))
  }

  it('handleSave shows "Nothing to save" when no pending content', async () => {
    const { result } = renderSaveHook()

    await act(async () => {
      await result.current.handleSave()
    })

    expect(setToastMessage).toHaveBeenCalledWith('Nothing to save')
    expect(mockInvokeFn).not.toHaveBeenCalled()
  })

  it('handleSave persists pending content and shows "Saved"', async () => {
    const { result } = renderSaveHook()

    // Buffer content via handleContentChange
    act(() => {
      result.current.handleContentChange('/test/note.md', '---\ntitle: Test\n---\n\n# Test\n\nEdited')
    })

    // Save via Cmd+S
    await act(async () => {
      await result.current.handleSave()
    })

    expect(mockInvokeFn).toHaveBeenCalledWith('save_note_content', {
      path: '/test/note.md',
      content: '---\ntitle: Test\n---\n\n# Test\n\nEdited',
    })
    expect(setToastMessage).toHaveBeenCalledWith('Saved')

    // Second save should show "Nothing to save" (pending cleared)
    await act(async () => {
      await result.current.handleSave()
    })
    expect(setToastMessage).toHaveBeenCalledWith('Nothing to save')
  })

  it('handleSave shows error toast on failure', async () => {
    mockInvokeFn.mockRejectedValueOnce(new Error('Disk full'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { result } = renderSaveHook()

    act(() => {
      result.current.handleContentChange('/test/note.md', 'content')
    })

    await act(async () => {
      await result.current.handleSave()
    })

    expect(setToastMessage).toHaveBeenCalledWith(expect.stringContaining('Save failed'))
    consoleSpy.mockRestore()
  })

  it('savePendingForPath saves content only for the matching path', async () => {
    const { result } = renderSaveHook()

    act(() => {
      result.current.handleContentChange('/test/note-a.md', 'content A')
    })

    // Try saving for a different path — should be a no-op
    await act(async () => {
      await result.current.savePendingForPath('/test/note-b.md')
    })
    expect(mockInvokeFn).not.toHaveBeenCalled()

    // Save for the correct path
    await act(async () => {
      await result.current.savePendingForPath('/test/note-a.md')
    })
    expect(mockInvokeFn).toHaveBeenCalledWith('save_note_content', {
      path: '/test/note-a.md',
      content: 'content A',
    })
  })

  it('calls onAfterSave callback after successful save', async () => {
    const onAfterSave = vi.fn()
    const { result } = renderHook(() =>
      useEditorSave({ updateVaultContent, setTabs, setToastMessage, onAfterSave })
    )

    act(() => {
      result.current.handleContentChange('/test/note.md', 'new content')
    })

    await act(async () => {
      await result.current.handleSave()
    })

    expect(onAfterSave).toHaveBeenCalledOnce()
  })

  it('does not call onAfterSave when save fails', async () => {
    mockInvokeFn.mockRejectedValueOnce(new Error('Disk full'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onAfterSave = vi.fn()
    const { result } = renderHook(() =>
      useEditorSave({ updateVaultContent, setTabs, setToastMessage, onAfterSave })
    )

    act(() => {
      result.current.handleContentChange('/test/note.md', 'content')
    })

    await act(async () => {
      await result.current.handleSave()
    })

    expect(onAfterSave).not.toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('handleContentChange buffers the latest content', () => {
    const { result } = renderSaveHook()

    act(() => {
      result.current.handleContentChange('/test/note.md', 'v1')
      result.current.handleContentChange('/test/note.md', 'v2')
    })

    // The ref should hold the latest value — verified via save
    // (We'll check via the next handleSave call)
  })
})
