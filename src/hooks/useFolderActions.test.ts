import { useEffect, useRef, useState } from 'react'
import { renderHook, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SidebarSelection, VaultEntry } from '../types'
import { useFolderActions } from './useFolderActions'

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: vi.fn(),
}))

const { mockInvoke } = await import('../mock-tauri')
const mockInvokeFn = mockInvoke as ReturnType<typeof vi.fn>

const folderEntry: VaultEntry = {
  path: '/vault/projects/note.md',
  filename: 'note.md',
  title: 'Note',
  isA: 'Note',
  aliases: [],
  belongsTo: [],
  relatedTo: [],
  status: null,
  archived: false,
  modifiedAt: null,
  createdAt: null,
  fileSize: 10,
  snippet: '',
  wordCount: 0,
  relationships: {},
  icon: null,
  color: null,
  order: null,
  sidebarLabel: null,
  template: null,
  sort: null,
  view: null,
  visible: null,
  organized: false,
  favorite: false,
  favoriteIndex: null,
  listPropertiesDisplay: [],
  outgoingLinks: [],
  properties: {},
  hasH1: true,
}

function renderFolderActions({
  initialSelection,
  initialTabs = [{ entry: folderEntry, content: '# Note' }],
  reloadVault,
  reloadFolders,
  setToastMessage,
  vaultPath = '/vault',
}: {
  initialSelection: SidebarSelection
  initialTabs?: Array<{ entry: VaultEntry; content: string }>
  reloadVault: ReturnType<typeof vi.fn>
  reloadFolders: ReturnType<typeof vi.fn>
  setToastMessage: ReturnType<typeof vi.fn>
  vaultPath?: string
}) {
  return renderHook(() => {
    const [selection, setSelection] = useState<SidebarSelection>(initialSelection)
    const [tabs, setTabs] = useState(initialTabs)
    const [activeTabPath, setActiveTabPath] = useState<string | null>(initialTabs[0]?.entry.path ?? null)
    const activeTabPathRef = useRef(activeTabPath)

    useEffect(() => {
      activeTabPathRef.current = activeTabPath
    }, [activeTabPath])

    const actions = useFolderActions({
      vaultPath,
      selection,
      setSelection,
      setTabs,
      activeTabPathRef,
      handleSwitchTab: setActiveTabPath,
      closeAllTabs: () => {
        setTabs([])
        setActiveTabPath(null)
      },
      reloadVault,
      reloadFolders,
      setToastMessage,
    })

    return { actions, selection, tabs, activeTabPath }
  })
}

describe('useFolderActions', () => {
  let reloadVault: ReturnType<typeof vi.fn>
  let reloadFolders: ReturnType<typeof vi.fn>
  let setToastMessage: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockInvokeFn.mockReset()
    reloadVault = vi.fn()
    reloadFolders = vi.fn().mockResolvedValue([])
    setToastMessage = vi.fn()
  })

  it('renames a selected folder and updates selection plus active tab path', async () => {
    const renamedEntry = { ...folderEntry, path: '/vault/work/note.md' }
    reloadVault.mockResolvedValue([renamedEntry])
    mockInvokeFn.mockResolvedValue({ old_path: 'projects', new_path: 'work' })

    const { result } = renderFolderActions({
      initialSelection: { kind: 'folder', path: 'projects' },
      reloadVault,
      reloadFolders,
      setToastMessage,
    })

    await act(async () => {
      await result.current.actions.renameFolder('projects', 'work')
    })

    expect(result.current.selection).toEqual({ kind: 'folder', path: 'work' })
    expect(result.current.tabs[0]?.entry.path).toBe('/vault/work/note.md')
    expect(result.current.activeTabPath).toBe('/vault/work/note.md')
    expect(mockInvokeFn).toHaveBeenCalledWith('rename_vault_folder', {
      vaultPath: '/vault',
      folderPath: 'projects',
      newName: 'work',
    })
    expect(setToastMessage).toHaveBeenCalledWith('Renamed folder to "work"')
  })

  it('renames a Team folder against that row rootPath instead of the active vault', async () => {
    reloadVault.mockResolvedValue([])
    mockInvokeFn.mockResolvedValue({ old_path: 'projects', new_path: 'work' })

    const { result } = renderFolderActions({
      initialSelection: { kind: 'folder', path: 'projects', rootPath: '/Users/luca/Team' },
      reloadVault,
      reloadFolders,
      setToastMessage,
      vaultPath: '/Users/luca/Personal',
    })

    await act(async () => {
      await result.current.actions.renameFolder('projects', 'work', '/Users/luca/Team')
    })

    expect(mockInvokeFn).toHaveBeenCalledWith('rename_vault_folder', {
      vaultPath: '/Users/luca/Team',
      folderPath: 'projects',
      newName: 'work',
    })
    expect(mockInvokeFn).not.toHaveBeenCalledWith('rename_vault_folder', expect.objectContaining({
      vaultPath: '/Users/luca/Personal',
    }))
    expect(result.current.selection).toEqual({
      kind: 'folder',
      path: 'work',
      rootPath: '/Users/luca/Team',
    })
  })

  it('uses selected-folder rootPath for rename when submit omits the third argument', async () => {
    reloadVault.mockResolvedValue([])
    mockInvokeFn.mockResolvedValue({ old_path: 'projects', new_path: 'work' })

    const { result } = renderFolderActions({
      initialSelection: { kind: 'folder', path: 'projects', rootPath: '/Users/luca/Team' },
      reloadVault,
      reloadFolders,
      setToastMessage,
      vaultPath: '/Users/luca/Personal',
    })

    act(() => {
      result.current.actions.renameSelectedFolder()
    })

    await act(async () => {
      await result.current.actions.renameFolder('projects', 'work')
    })

    expect(mockInvokeFn).toHaveBeenCalledWith('rename_vault_folder', {
      vaultPath: '/Users/luca/Team',
      folderPath: 'projects',
      newName: 'work',
    })
  })

  it('deletes a selected folder and clears the active note gracefully', async () => {
    reloadVault.mockResolvedValue([])
    mockInvokeFn.mockResolvedValue('projects')

    const { result } = renderFolderActions({
      initialSelection: { kind: 'folder', path: 'projects' },
      reloadVault,
      reloadFolders,
      setToastMessage,
    })

    act(() => {
      result.current.actions.requestDeleteFolder('projects')
    })

    await act(async () => {
      await result.current.actions.confirmDeleteSelectedFolder()
    })

    expect(result.current.selection).toEqual({ kind: 'filter', filter: 'all' })
    expect(result.current.tabs).toEqual([])
    expect(result.current.activeTabPath).toBeNull()
    expect(mockInvokeFn).toHaveBeenCalledWith('delete_vault_folder', {
      vaultPath: '/vault',
      folderPath: 'projects',
    })
    expect(setToastMessage).toHaveBeenCalledWith('Deleted folder "projects"')
  })

  it('deletes a Team folder against that row rootPath instead of the active vault', async () => {
    reloadVault.mockResolvedValue([])
    mockInvokeFn.mockResolvedValue('projects')

    const { result } = renderFolderActions({
      initialSelection: { kind: 'folder', path: 'projects', rootPath: '/Users/luca/Team' },
      reloadVault,
      reloadFolders,
      setToastMessage,
      vaultPath: '/Users/luca/Personal',
    })

    act(() => {
      result.current.actions.deleteSelectedFolder()
    })

    await act(async () => {
      await result.current.actions.confirmDeleteSelectedFolder()
    })

    expect(mockInvokeFn).toHaveBeenCalledWith('delete_vault_folder', {
      vaultPath: '/Users/luca/Team',
      folderPath: 'projects',
    })
    expect(mockInvokeFn).not.toHaveBeenCalledWith('delete_vault_folder', expect.objectContaining({
      vaultPath: '/Users/luca/Personal',
    }))
  })
})
