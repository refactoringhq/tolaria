import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useBulkActions } from './useBulkActions'

describe('useBulkActions', () => {
  let handleArchiveNote: ReturnType<typeof vi.fn>
  let handleTrashNote: ReturnType<typeof vi.fn>
  let handleRestoreNote: ReturnType<typeof vi.fn>
  let setToastMessage: ReturnType<typeof vi.fn>

  beforeEach(() => {
    handleArchiveNote = vi.fn().mockResolvedValue(undefined)
    handleTrashNote = vi.fn().mockResolvedValue(undefined)
    handleRestoreNote = vi.fn().mockResolvedValue(undefined)
    setToastMessage = vi.fn()
  })

  function renderBulkActions() {
    return renderHook(() =>
      useBulkActions(
        { handleArchiveNote, handleTrashNote, handleRestoreNote },
        setToastMessage,
      ),
    )
  }

  // --- handleBulkArchive ---

  describe('handleBulkArchive', () => {
    it('archives each path and shows plural toast for multiple notes', async () => {
      const { result } = renderBulkActions()
      await act(async () => {
        await result.current.handleBulkArchive(['/vault/a.md', '/vault/b.md'])
      })
      expect(handleArchiveNote).toHaveBeenCalledTimes(2)
      expect(handleArchiveNote).toHaveBeenCalledWith('/vault/a.md')
      expect(handleArchiveNote).toHaveBeenCalledWith('/vault/b.md')
      expect(setToastMessage).toHaveBeenCalledWith('2 notes archived')
    })

    it('shows singular toast when one note archived', async () => {
      const { result } = renderBulkActions()
      await act(async () => {
        await result.current.handleBulkArchive(['/vault/a.md'])
      })
      expect(setToastMessage).toHaveBeenCalledWith('1 note archived')
    })

    it('does not show toast when empty array given', async () => {
      const { result } = renderBulkActions()
      await act(async () => {
        await result.current.handleBulkArchive([])
      })
      expect(handleArchiveNote).not.toHaveBeenCalled()
      expect(setToastMessage).not.toHaveBeenCalled()
    })

    it('skips failed paths and only counts successes in toast', async () => {
      handleArchiveNote
        .mockResolvedValueOnce(undefined) // /vault/a.md succeeds
        .mockRejectedValueOnce(new Error('fail')) // /vault/b.md fails
        .mockResolvedValueOnce(undefined) // /vault/c.md succeeds
      const { result } = renderBulkActions()
      await act(async () => {
        await result.current.handleBulkArchive(['/vault/a.md', '/vault/b.md', '/vault/c.md'])
      })
      expect(handleArchiveNote).toHaveBeenCalledTimes(3)
      expect(setToastMessage).toHaveBeenCalledWith('2 notes archived')
    })

    it('shows no toast when all paths fail', async () => {
      handleArchiveNote.mockRejectedValue(new Error('fail'))
      const { result } = renderBulkActions()
      await act(async () => {
        await result.current.handleBulkArchive(['/vault/a.md', '/vault/b.md'])
      })
      expect(setToastMessage).not.toHaveBeenCalled()
    })
  })

  // --- handleBulkTrash ---

  describe('handleBulkTrash', () => {
    it('trashes each path and shows plural toast', async () => {
      const { result } = renderBulkActions()
      await act(async () => {
        await result.current.handleBulkTrash(['/vault/a.md', '/vault/b.md'])
      })
      expect(handleTrashNote).toHaveBeenCalledTimes(2)
      expect(setToastMessage).toHaveBeenCalledWith('2 notes moved to trash')
    })

    it('shows singular toast when one note trashed', async () => {
      const { result } = renderBulkActions()
      await act(async () => {
        await result.current.handleBulkTrash(['/vault/a.md'])
      })
      expect(setToastMessage).toHaveBeenCalledWith('1 note moved to trash')
    })

    it('does not show toast when empty array given', async () => {
      const { result } = renderBulkActions()
      await act(async () => {
        await result.current.handleBulkTrash([])
      })
      expect(setToastMessage).not.toHaveBeenCalled()
    })

    it('skips failed paths and counts only successes', async () => {
      handleTrashNote
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce(undefined)
      const { result } = renderBulkActions()
      await act(async () => {
        await result.current.handleBulkTrash(['/vault/a.md', '/vault/b.md'])
      })
      expect(setToastMessage).toHaveBeenCalledWith('1 note moved to trash')
    })

    it('shows no toast when all fail', async () => {
      handleTrashNote.mockRejectedValue(new Error('fail'))
      const { result } = renderBulkActions()
      await act(async () => {
        await result.current.handleBulkTrash(['/vault/a.md'])
      })
      expect(setToastMessage).not.toHaveBeenCalled()
    })
  })

  // --- handleBulkRestore ---

  describe('handleBulkRestore', () => {
    it('restores each path and shows plural toast', async () => {
      const { result } = renderBulkActions()
      await act(async () => {
        await result.current.handleBulkRestore(['/vault/a.md', '/vault/b.md', '/vault/c.md'])
      })
      expect(handleRestoreNote).toHaveBeenCalledTimes(3)
      expect(setToastMessage).toHaveBeenCalledWith('3 notes restored')
    })

    it('shows singular toast when one note restored', async () => {
      const { result } = renderBulkActions()
      await act(async () => {
        await result.current.handleBulkRestore(['/vault/only.md'])
      })
      expect(setToastMessage).toHaveBeenCalledWith('1 note restored')
    })

    it('does not show toast when empty array given', async () => {
      const { result } = renderBulkActions()
      await act(async () => {
        await result.current.handleBulkRestore([])
      })
      expect(setToastMessage).not.toHaveBeenCalled()
    })

    it('partial failure: counts only successful restores in toast', async () => {
      handleRestoreNote
        .mockResolvedValueOnce(undefined)  // /vault/a.md ok
        .mockRejectedValueOnce(new Error('not found'))  // /vault/b.md fails
        .mockResolvedValueOnce(undefined)  // /vault/c.md ok
      const { result } = renderBulkActions()
      await act(async () => {
        await result.current.handleBulkRestore(['/vault/a.md', '/vault/b.md', '/vault/c.md'])
      })
      expect(handleRestoreNote).toHaveBeenCalledTimes(3)
      expect(setToastMessage).toHaveBeenCalledWith('2 notes restored')
    })

    it('shows no toast when all restores fail', async () => {
      handleRestoreNote.mockRejectedValue(new Error('fail'))
      const { result } = renderBulkActions()
      await act(async () => {
        await result.current.handleBulkRestore(['/vault/a.md', '/vault/b.md'])
      })
      expect(setToastMessage).not.toHaveBeenCalled()
    })
  })
})
