import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDeleteActions } from './useDeleteActions'

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: vi.fn(),
}))

const { mockInvoke } = await import('../mock-tauri')
const mockInvokeFn = mockInvoke as ReturnType<typeof vi.fn>

function makeEntry(path: string, trashed = false) {
  return { path, trashed } as { path: string; trashed: boolean }
}

describe('useDeleteActions', () => {
  let handleCloseTab: ReturnType<typeof vi.fn>
  let removeEntry: ReturnType<typeof vi.fn>
  let setToastMessage: ReturnType<typeof vi.fn>

  beforeEach(() => {
    handleCloseTab = vi.fn()
    removeEntry = vi.fn()
    setToastMessage = vi.fn()
    mockInvokeFn.mockReset()
  })

  function renderDeleteActions(entries = [makeEntry('/vault/a.md'), makeEntry('/vault/t.md', true)]) {
    return renderHook(() =>
      useDeleteActions({
        vaultPath: '/vault',
        entries,
        handleCloseTab,
        removeEntry,
        setToastMessage,
      }),
    )
  }

  // --- trashedCount ---

  describe('trashedCount', () => {
    it('counts trashed entries', () => {
      const { result } = renderDeleteActions([
        makeEntry('/vault/a.md'),
        makeEntry('/vault/b.md', true),
        makeEntry('/vault/c.md', true),
      ])
      expect(result.current.trashedCount).toBe(2)
    })

    it('returns 0 when no trashed entries', () => {
      const { result } = renderDeleteActions([makeEntry('/vault/a.md')])
      expect(result.current.trashedCount).toBe(0)
    })
  })

  // --- deleteNoteFromDisk ---

  describe('deleteNoteFromDisk', () => {
    it('invokes delete_note, closes tab, removes entry, returns true', async () => {
      mockInvokeFn.mockResolvedValue(undefined)
      const { result } = renderDeleteActions()
      let ok: boolean | undefined
      await act(async () => {
        ok = await result.current.deleteNoteFromDisk('/vault/a.md')
      })
      expect(ok).toBe(true)
      expect(mockInvokeFn).toHaveBeenCalledWith('delete_note', { path: '/vault/a.md' })
      expect(handleCloseTab).toHaveBeenCalledWith('/vault/a.md')
      expect(removeEntry).toHaveBeenCalledWith('/vault/a.md')
    })

    it('shows toast and returns false on failure', async () => {
      mockInvokeFn.mockRejectedValue(new Error('disk full'))
      const { result } = renderDeleteActions()
      let ok: boolean | undefined
      await act(async () => {
        ok = await result.current.deleteNoteFromDisk('/vault/a.md')
      })
      expect(ok).toBe(false)
      expect(setToastMessage).toHaveBeenCalledWith(expect.stringContaining('Failed to delete'))
    })
  })

  // --- handleDeleteNote ---

  describe('handleDeleteNote', () => {
    it('sets confirmDelete dialog state', async () => {
      const { result } = renderDeleteActions()
      await act(async () => {
        await result.current.handleDeleteNote('/vault/a.md')
      })
      expect(result.current.confirmDelete).not.toBeNull()
      expect(result.current.confirmDelete?.title).toBe('Delete permanently?')
    })

    it('onConfirm deletes the note and clears dialog', async () => {
      mockInvokeFn.mockResolvedValue(undefined)
      const { result } = renderDeleteActions()
      await act(async () => {
        await result.current.handleDeleteNote('/vault/a.md')
      })
      await act(async () => {
        await result.current.confirmDelete!.onConfirm()
      })
      expect(result.current.confirmDelete).toBeNull()
      expect(mockInvokeFn).toHaveBeenCalledWith('delete_note', { path: '/vault/a.md' })
      expect(setToastMessage).toHaveBeenCalledWith('Note permanently deleted')
    })
  })

  // --- handleBulkDeletePermanently ---

  describe('handleBulkDeletePermanently', () => {
    it('sets confirmDelete with correct plural title', () => {
      const { result } = renderDeleteActions()
      act(() => {
        result.current.handleBulkDeletePermanently(['/vault/a.md', '/vault/b.md'])
      })
      expect(result.current.confirmDelete?.title).toBe('Delete 2 notes permanently?')
    })

    it('sets confirmDelete with singular title for one note', () => {
      const { result } = renderDeleteActions()
      act(() => {
        result.current.handleBulkDeletePermanently(['/vault/a.md'])
      })
      expect(result.current.confirmDelete?.title).toBe('Delete 1 note permanently?')
    })

    it('onConfirm deletes all paths and shows toast', async () => {
      mockInvokeFn.mockResolvedValue(undefined)
      const { result } = renderDeleteActions()
      act(() => {
        result.current.handleBulkDeletePermanently(['/vault/a.md', '/vault/b.md'])
      })
      await act(async () => {
        await result.current.confirmDelete!.onConfirm()
      })
      expect(result.current.confirmDelete).toBeNull()
      expect(mockInvokeFn).toHaveBeenCalledTimes(2)
      expect(setToastMessage).toHaveBeenCalledWith('2 notes permanently deleted')
    })
  })

  // --- handleEmptyTrash ---

  describe('handleEmptyTrash', () => {
    it('does nothing when trashedCount is 0', () => {
      const { result } = renderDeleteActions([makeEntry('/vault/a.md')])
      act(() => {
        result.current.handleEmptyTrash()
      })
      expect(result.current.confirmDelete).toBeNull()
    })

    it('sets confirmDelete with trash count in message', () => {
      const { result } = renderDeleteActions([
        makeEntry('/vault/a.md'),
        makeEntry('/vault/t1.md', true),
        makeEntry('/vault/t2.md', true),
      ])
      act(() => {
        result.current.handleEmptyTrash()
      })
      expect(result.current.confirmDelete?.title).toBe('Empty Trash?')
      expect(result.current.confirmDelete?.confirmLabel).toBe('Empty Trash')
    })

    it('onConfirm invokes empty_trash, closes tabs, removes entries', async () => {
      mockInvokeFn.mockResolvedValue(['/vault/t1.md', '/vault/t2.md'])
      const { result } = renderDeleteActions([
        makeEntry('/vault/a.md'),
        makeEntry('/vault/t1.md', true),
        makeEntry('/vault/t2.md', true),
      ])
      act(() => {
        result.current.handleEmptyTrash()
      })
      await act(async () => {
        await result.current.confirmDelete!.onConfirm()
      })
      expect(result.current.confirmDelete).toBeNull()
      expect(mockInvokeFn).toHaveBeenCalledWith('empty_trash', { vaultPath: '/vault' })
      expect(handleCloseTab).toHaveBeenCalledWith('/vault/t1.md')
      expect(handleCloseTab).toHaveBeenCalledWith('/vault/t2.md')
      expect(removeEntry).toHaveBeenCalledWith('/vault/t1.md')
      expect(removeEntry).toHaveBeenCalledWith('/vault/t2.md')
      expect(setToastMessage).toHaveBeenCalledWith('2 notes permanently deleted')
    })

    it('shows error toast when empty_trash fails', async () => {
      mockInvokeFn.mockRejectedValue(new Error('oops'))
      const { result } = renderDeleteActions([makeEntry('/vault/t.md', true)])
      act(() => {
        result.current.handleEmptyTrash()
      })
      await act(async () => {
        await result.current.confirmDelete!.onConfirm()
      })
      expect(setToastMessage).toHaveBeenCalledWith(expect.stringContaining('Failed to empty trash'))
    })
  })

  // --- setConfirmDelete ---

  describe('setConfirmDelete', () => {
    it('can clear confirmDelete via setConfirmDelete(null)', async () => {
      const { result } = renderDeleteActions()
      await act(async () => {
        await result.current.handleDeleteNote('/vault/a.md')
      })
      expect(result.current.confirmDelete).not.toBeNull()
      act(() => {
        result.current.setConfirmDelete(null)
      })
      expect(result.current.confirmDelete).toBeNull()
    })
  })
})
