import { useCallback, useMemo, useState } from 'react'
import type { SidebarSelection } from '../../types'
import { ancestorTreePaths, expandedTreePaths, folderNodeKey, mergeExpandedPaths, scopedFolderKeys } from './folderTreeUtils'
import type { FolderRenameTarget } from '../../hooks/folder-actions/useFolderRename'

interface UseFolderTreeDisclosureInput {
  collapsed?: boolean
  onToggle?: () => void
  renamingFolderPath?: FolderRenameTarget | string | null
  selection: SidebarSelection
}

function renamingExpansionPaths(renamingFolderPath?: FolderRenameTarget | string | null): string[] {
  if (!renamingFolderPath) return []
  const target = typeof renamingFolderPath === 'string' ? { path: renamingFolderPath } : renamingFolderPath
  const paths = expandedTreePaths(target.path)
  if (!target.rootPath) return paths
  return [
    folderNodeKey({ path: '', rootPath: target.rootPath }),
    ...scopedFolderKeys(paths, target.rootPath),
  ]
}

function useExpandedFolders(selection: SidebarSelection, renamingFolderPath?: FolderRenameTarget | string | null) {
  const [manualExpanded, setManualExpanded] = useState<Record<string, boolean>>({})
  const requiredExpandedPaths = useMemo(() => {
    const nextPaths: string[] = []
    if (selection.kind === 'folder') {
      if (selection.path && selection.rootPath) nextPaths.push(folderNodeKey({ path: '', rootPath: selection.rootPath }))
      nextPaths.push(...scopedFolderKeys(ancestorTreePaths(selection.path), selection.rootPath))
    }
    nextPaths.push(...renamingExpansionPaths(renamingFolderPath))
    return [...new Set(nextPaths)]
  }, [renamingFolderPath, selection])

  const expanded = useMemo(
    () => mergeExpandedPaths(manualExpanded, requiredExpandedPaths),
    [manualExpanded, requiredExpandedPaths],
  )

  const toggleFolder = useCallback((key: string) => {
    setManualExpanded((current) => {
      const defaultExpanded = key.endsWith('::') || key === ''
      const next = { ...current }
      Reflect.set(next, key, !((Reflect.get(current, key) as boolean | undefined) ?? defaultExpanded))
      return next
    })
  }, [])

  const expandFolder = useCallback((key: string) => {
    setManualExpanded((current) => {
      if (Reflect.get(current, key) === true) return current
      return { ...current, [key]: true }
    })
  }, [])

  return {
    expanded,
    expandFolder,
    toggleFolder,
  }
}

function useFolderSectionState(
  externalCollapsed: boolean | undefined,
  onToggle: (() => void) | undefined,
  renamingFolderPath?: FolderRenameTarget | string | null,
) {
  const [internalCollapsed, setInternalCollapsed] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  const baseSectionCollapsed = externalCollapsed ?? internalCollapsed
  const sectionCollapsed = !isCreating && !renamingFolderPath && baseSectionCollapsed

  const handleToggleSection = useCallback(() => {
    if (onToggle) {
      onToggle()
      return
    }
    setInternalCollapsed((current) => !current)
  }, [onToggle])

  const openCreateForm = useCallback(() => {
    if (baseSectionCollapsed) {
      if (onToggle) onToggle()
      else setInternalCollapsed(false)
    }
    setIsCreating(true)
  }, [baseSectionCollapsed, onToggle])

  const closeCreateForm = useCallback(() => setIsCreating(false), [])

  return {
    handleToggleSection,
    isCreating,
    openCreateForm,
    sectionCollapsed,
    closeCreateForm,
  }
}

export function useFolderTreeDisclosure({
  collapsed: externalCollapsed,
  onToggle,
  renamingFolderPath,
  selection,
}: UseFolderTreeDisclosureInput) {
  const { expanded, expandFolder, toggleFolder } = useExpandedFolders(selection, renamingFolderPath)
  const {
    closeCreateForm,
    handleToggleSection,
    isCreating,
    openCreateForm,
    sectionCollapsed,
  } = useFolderSectionState(externalCollapsed, onToggle, renamingFolderPath)

  return {
    closeCreateForm,
    expanded,
    expandFolder,
    handleToggleSection,
    isCreating,
    openCreateForm,
    sectionCollapsed,
    toggleFolder,
  }
}
