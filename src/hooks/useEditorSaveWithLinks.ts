import { useCallback, useRef } from 'react'
import { useEditorSave } from './useEditorSave'
import { extractOutgoingLinks } from '../utils/wikilinks'
import type { VaultEntry } from '../types'

export function useEditorSaveWithLinks(config: {
  updateContent: (path: string, content: string) => void
  updateEntry: (path: string, patch: Partial<VaultEntry>) => void
  setTabs: Parameters<typeof useEditorSave>[0]['setTabs']
  setToastMessage: (msg: string | null) => void
  onAfterSave: () => void
  onNotePersisted?: (path: string) => void
}) {
  const { updateContent, updateEntry } = config
  const saveContent = useCallback((path: string, content: string) => {
    updateContent(path, content)
    updateEntry(path, { outgoingLinks: extractOutgoingLinks(content) })
  }, [updateContent, updateEntry])
  const editor = useEditorSave({ updateVaultContent: saveContent, setTabs: config.setTabs, setToastMessage: config.setToastMessage, onAfterSave: config.onAfterSave, onNotePersisted: config.onNotePersisted })
  const { handleContentChange: rawOnChange } = editor
  const prevLinksKeyRef = useRef('')
  const handleContentChange = useCallback((path: string, content: string) => {
    rawOnChange(path, content)
    const links = extractOutgoingLinks(content)
    const key = links.join('\0')
    if (key !== prevLinksKeyRef.current) {
      prevLinksKeyRef.current = key
      updateEntry(path, { outgoingLinks: links })
    }
  }, [rawOnChange, updateEntry])
  return { ...editor, handleContentChange }
}
