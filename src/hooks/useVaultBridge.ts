import { useCallback } from 'react'
import type { VaultEntry } from '../types'

interface VaultBridgeDeps {
  entriesByPath: Map<string, VaultEntry>
  resolvedPath: string
  reloadVault: () => Promise<unknown>
  onSelectNote: (entry: VaultEntry) => void
  activeTabPath: string | null
}

function findEntry(entriesByPath: Map<string, VaultEntry>, resolvedPath: string, path: string): VaultEntry | undefined {
  return entriesByPath.get(path) ?? entriesByPath.get(`${resolvedPath}/${path}`)
}

function findInFresh(entries: unknown, resolvedPath: string, path: string): VaultEntry | undefined {
  return (entries as VaultEntry[]).find(e => e.path === path || e.path === `${resolvedPath}/${path}`)
}

export function useVaultBridge({
  entriesByPath, resolvedPath, reloadVault, onSelectNote, activeTabPath,
}: VaultBridgeDeps) {
  const reloadAndOpen = useCallback((path: string) => {
    reloadVault().then(fresh => {
      const entry = findInFresh(fresh, resolvedPath, path)
      if (entry) onSelectNote(entry)
    })
  }, [reloadVault, onSelectNote, resolvedPath])

  const openNoteByPath = useCallback((path: string) => {
    const entry = findEntry(entriesByPath, resolvedPath, path)
    if (entry) onSelectNote(entry)
    else reloadAndOpen(path)
  }, [entriesByPath, resolvedPath, onSelectNote, reloadAndOpen])

  const handlePulseOpenNote = useCallback((relativePath: string) => {
    const entry = findEntry(entriesByPath, resolvedPath, `${resolvedPath}/${relativePath}`)
      ?? entriesByPath.get(relativePath)
    if (entry) onSelectNote(entry)
  }, [entriesByPath, resolvedPath, onSelectNote])

  const handleAgentFileModified = useCallback((relativePath: string) => {
    const fullPath = `${resolvedPath}/${relativePath}`
    if (activeTabPath === relativePath || activeTabPath === fullPath) reloadVault()
  }, [reloadVault, activeTabPath, resolvedPath])

  const handleAgentVaultChanged = useCallback(() => { reloadVault() }, [reloadVault])

  return {
    openNoteByPath,
    handlePulseOpenNote,
    handleAgentFileCreated: reloadAndOpen,
    handleAgentFileModified,
    handleAgentVaultChanged,
  }
}
