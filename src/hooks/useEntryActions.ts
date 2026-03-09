import { useCallback } from 'react'
import type { VaultEntry } from '../types'

interface EntryActionsConfig {
  entries: VaultEntry[]
  updateEntry: (path: string, updates: Partial<VaultEntry>) => void
  handleUpdateFrontmatter: (path: string, key: string, value: string | number | boolean | string[]) => Promise<void>
  handleDeleteProperty: (path: string, key: string) => Promise<void>
  setToastMessage: (msg: string | null) => void
  createTypeEntry: (typeName: string) => Promise<VaultEntry>
  onFrontmatterPersisted?: () => void
  /** Called before trash/archive to flush unsaved editor content to disk. */
  onBeforeAction?: (path: string) => Promise<void>
}

function findTypeEntry(entries: VaultEntry[], typeName: string): VaultEntry | undefined {
  return entries.find((e) => e.isA === 'Type' && e.title === typeName)
}

async function findOrCreateType(
  entries: VaultEntry[], typeName: string, create: (name: string) => Promise<VaultEntry>,
): Promise<VaultEntry> {
  return findTypeEntry(entries, typeName) ?? await create(typeName)
}

export function useEntryActions({
  entries, updateEntry, handleUpdateFrontmatter, handleDeleteProperty, setToastMessage, createTypeEntry, onFrontmatterPersisted, onBeforeAction,
}: EntryActionsConfig) {
  const handleTrashNote = useCallback(async (path: string) => {
    await onBeforeAction?.(path)
    // Optimistic: update UI immediately, write to disk async with rollback on failure
    const trashedAt = Date.now() / 1000
    updateEntry(path, { trashed: true, trashedAt })
    setToastMessage('Note moved to trash')
    const now = new Date().toISOString().slice(0, 10)
    try {
      await handleUpdateFrontmatter(path, 'Trashed', true)
      await handleUpdateFrontmatter(path, 'Trashed at', now)
      onFrontmatterPersisted?.()
    } catch (err) {
      updateEntry(path, { trashed: false, trashedAt: null })
      setToastMessage('Failed to trash note — rolled back')
      console.error('Optimistic trash rollback:', err)
    }
  }, [onBeforeAction, handleUpdateFrontmatter, updateEntry, setToastMessage, onFrontmatterPersisted])

  const handleRestoreNote = useCallback(async (path: string) => {
    // Optimistic: update UI immediately
    updateEntry(path, { trashed: false, trashedAt: null })
    setToastMessage('Note restored from trash')
    try {
      await handleUpdateFrontmatter(path, 'Trashed', false)
      await handleDeleteProperty(path, 'Trashed at')
      onFrontmatterPersisted?.()
    } catch (err) {
      updateEntry(path, { trashed: true, trashedAt: Date.now() / 1000 })
      setToastMessage('Failed to restore note — rolled back')
      console.error('Optimistic restore rollback:', err)
    }
  }, [handleUpdateFrontmatter, handleDeleteProperty, updateEntry, setToastMessage, onFrontmatterPersisted])

  const handleArchiveNote = useCallback(async (path: string) => {
    await onBeforeAction?.(path)
    // Optimistic: update UI immediately, write to disk async with rollback on failure
    updateEntry(path, { archived: true })
    setToastMessage('Note archived')
    try {
      await handleUpdateFrontmatter(path, 'archived', true)
      onFrontmatterPersisted?.()
    } catch (err) {
      updateEntry(path, { archived: false })
      setToastMessage('Failed to archive note — rolled back')
      console.error('Optimistic archive rollback:', err)
    }
  }, [onBeforeAction, handleUpdateFrontmatter, updateEntry, setToastMessage, onFrontmatterPersisted])

  const handleUnarchiveNote = useCallback(async (path: string) => {
    // Optimistic: update UI immediately
    updateEntry(path, { archived: false })
    setToastMessage('Note unarchived')
    try {
      await handleUpdateFrontmatter(path, 'archived', false)
      onFrontmatterPersisted?.()
    } catch (err) {
      updateEntry(path, { archived: true })
      setToastMessage('Failed to unarchive note — rolled back')
      console.error('Optimistic unarchive rollback:', err)
    }
  }, [handleUpdateFrontmatter, updateEntry, setToastMessage, onFrontmatterPersisted])

  const handleCustomizeType = useCallback(async (typeName: string, icon: string, color: string) => {
    const typeEntry = await findOrCreateType(entries, typeName, createTypeEntry)
    await handleUpdateFrontmatter(typeEntry.path, 'icon', icon)
    await handleUpdateFrontmatter(typeEntry.path, 'color', color)
    updateEntry(typeEntry.path, { icon, color })
    onFrontmatterPersisted?.()
  }, [entries, handleUpdateFrontmatter, updateEntry, createTypeEntry, onFrontmatterPersisted])

  const handleReorderSections = useCallback(async (orderedTypes: { typeName: string; order: number }[]) => {
    for (const { typeName, order } of orderedTypes) {
      const typeEntry = await findOrCreateType(entries, typeName, createTypeEntry)
      await handleUpdateFrontmatter(typeEntry.path, 'order', order)
      updateEntry(typeEntry.path, { order })
    }
    onFrontmatterPersisted?.()
  }, [entries, handleUpdateFrontmatter, updateEntry, createTypeEntry, onFrontmatterPersisted])

  const handleUpdateTypeTemplate = useCallback(async (typeName: string, template: string) => {
    const typeEntry = await findOrCreateType(entries, typeName, createTypeEntry)
    await handleUpdateFrontmatter(typeEntry.path, 'template', template)
    updateEntry(typeEntry.path, { template: template || null })
    onFrontmatterPersisted?.()
  }, [entries, handleUpdateFrontmatter, updateEntry, createTypeEntry, onFrontmatterPersisted])

  const handleRenameSection = useCallback(async (typeName: string, label: string) => {
    const typeEntry = await findOrCreateType(entries, typeName, createTypeEntry)
    const trimmed = label.trim()
    if (trimmed) {
      await handleUpdateFrontmatter(typeEntry.path, 'sidebar label', trimmed)
    } else {
      await handleDeleteProperty(typeEntry.path, 'sidebar label')
    }
    updateEntry(typeEntry.path, { sidebarLabel: trimmed || null })
    onFrontmatterPersisted?.()
  }, [entries, handleUpdateFrontmatter, handleDeleteProperty, updateEntry, createTypeEntry, onFrontmatterPersisted])

  const handleToggleTypeVisibility = useCallback(async (typeName: string) => {
    const typeEntry = await findOrCreateType(entries, typeName, createTypeEntry)
    if (typeEntry.visible === false) {
      await handleDeleteProperty(typeEntry.path, 'visible')
      updateEntry(typeEntry.path, { visible: null })
    } else {
      await handleUpdateFrontmatter(typeEntry.path, 'visible', false)
      updateEntry(typeEntry.path, { visible: false })
    }
    onFrontmatterPersisted?.()
  }, [entries, handleUpdateFrontmatter, handleDeleteProperty, updateEntry, createTypeEntry, onFrontmatterPersisted])

  return { handleTrashNote, handleRestoreNote, handleArchiveNote, handleUnarchiveNote, handleCustomizeType, handleReorderSections, handleUpdateTypeTemplate, handleRenameSection, handleToggleTypeVisibility }
}
