import { type MutableRefObject, useCallback, useEffect, useState } from 'react'
import type { VaultEntry } from '../types'
import type { NotePdfExportSource } from '../utils/notePdfExport'
import { isMarkdownEntry } from '../utils/typeDefinitions'

interface NoteListPdfExportOptions {
  activeEntry: VaultEntry | null
  onSelectNote: (entry: VaultEntry) => void
  pdfExportRef: MutableRefObject<((source?: NotePdfExportSource) => void) | null>
}

interface ExportAfterSelectionOptions extends Pick<NoteListPdfExportOptions, 'activeEntry' | 'pdfExportRef'> {
  pendingPath: string | null
  clearPendingPath: () => void
}

function useExportAfterSelection({
  activeEntry, pendingPath, pdfExportRef, clearPendingPath,
}: ExportAfterSelectionOptions) {
  useEffect(() => {
    if (!pendingPath) return
    if (!activeEntry || activeEntry.path !== pendingPath) return

    const frameId = requestAnimationFrame(() => {
      if (isMarkdownEntry(activeEntry)) pdfExportRef.current?.('note_list_context_menu')
      clearPendingPath()
    })

    return () => cancelAnimationFrame(frameId)
  }, [activeEntry, pendingPath, pdfExportRef, clearPendingPath])
}

export function useNoteListPdfExport({ activeEntry, onSelectNote, pdfExportRef }: NoteListPdfExportOptions) {
  const [pendingPath, setPendingPath] = useState<string | null>(null)
  const activePath = activeEntry?.path
  const clearPendingPath = useCallback(() => setPendingPath(null), [])
  const exportFromList = useCallback((entry: VaultEntry) => {
    if (!isMarkdownEntry(entry)) return

    if (activePath === entry.path) {
      pdfExportRef.current?.('note_list_context_menu')
      return
    }

    setPendingPath(entry.path)
    onSelectNote(entry)
  }, [activePath, onSelectNote, pdfExportRef])

  useExportAfterSelection({ activeEntry, pendingPath, pdfExportRef, clearPendingPath })

  return exportFromList
}
