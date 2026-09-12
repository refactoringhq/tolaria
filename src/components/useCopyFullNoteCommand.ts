import { useCallback, useEffect, type MutableRefObject } from 'react'
import type { useCreateBlockNote } from '@blocknote/react'
import type { VaultEntry } from '../types'
import { copyFullNoteToClipboard } from './editorFullNoteCopy'

type CopyFullNoteEditor = ReturnType<typeof useCreateBlockNote>

type CopyFullNoteActiveTab = {
  entry: Pick<VaultEntry, 'fileKind'>
} | null

interface CopyFullNoteCommandConfig {
  activeTab: CopyFullNoteActiveTab
  copyFullNoteRef?: MutableRefObject<(() => void) | null>
  editor: CopyFullNoteEditor
  rawMode: boolean
}

export function useCopyFullNoteCommand({
  activeTab,
  copyFullNoteRef,
  editor,
  rawMode,
}: CopyFullNoteCommandConfig) {
  const handleCopyFullNote = useCallback(() => {
    if (!activeTab || activeTab.entry.fileKind === 'binary' || rawMode) return

    void copyFullNoteToClipboard(editor)
      .catch((error) => {
        console.warn('[editor] Copy full note failed:', error)
      })
  }, [activeTab, editor, rawMode])

  useEffect(() => {
    if (!copyFullNoteRef) return

    copyFullNoteRef.current = handleCopyFullNote
    return () => {
      if (copyFullNoteRef.current === handleCopyFullNote) {
        copyFullNoteRef.current = null
      }
    }
  }, [handleCopyFullNote, copyFullNoteRef])
}
