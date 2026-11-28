import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { makeEntry } from '../test-utils/noteListTestUtils'
import { useNoteListPdfExport } from './useNoteListPdfExport'

const firstNote = makeEntry({ path: '/first.md', filename: 'first.md' })
const secondNote = makeEntry({ path: '/second.md', filename: 'second.md' })

afterEach(() => vi.useRealTimers())

it('exports the active note immediately without reselecting it', () => {
  const onSelectNote = vi.fn()
  const exportPdf = vi.fn()
  const { result } = renderHook(() => useNoteListPdfExport({
    activeEntry: firstNote,
    onSelectNote,
    pdfExportRef: { current: exportPdf },
  }))

  act(() => result.current(firstNote))

  expect(onSelectNote).not.toHaveBeenCalled()
  expect(exportPdf).toHaveBeenCalledExactlyOnceWith('note_list_context_menu')
})

it('waits for the requested note and cancels its queued export if selection changes before the frame', () => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] })
  const onSelectNote = vi.fn()
  const exportPdf = vi.fn()
  const pdfExportRef = { current: exportPdf }
  const { result, rerender } = renderHook(({ activeEntry }) => useNoteListPdfExport({
    activeEntry,
    onSelectNote,
    pdfExportRef,
  }), { initialProps: { activeEntry: firstNote } })

  act(() => result.current(secondNote))
  expect(onSelectNote).toHaveBeenCalledExactlyOnceWith(secondNote)

  rerender({ activeEntry: secondNote })
  expect(exportPdf).not.toHaveBeenCalled()
  rerender({ activeEntry: firstNote })
  act(() => vi.runOnlyPendingTimers())
  expect(exportPdf).not.toHaveBeenCalled()

  rerender({ activeEntry: secondNote })
  act(() => vi.runOnlyPendingTimers())
  expect(exportPdf).toHaveBeenCalledExactlyOnceWith('note_list_context_menu')
})
