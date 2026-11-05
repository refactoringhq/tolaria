// @vitest-environment jsdom
import { act, createElement, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mobileWorkspaceDeepLinkSlug } from '../mobileWorkspaceAlias'
import { preloadNativeWorkspace } from '../preloadNativeWorkspace'
import { managedGitSelection, readManagedGitCatalog, updateManagedGitCatalog } from './managedGitStorage'
import { initializeLocalVaultCatalog } from './managedLocalStorage'
import { useManagedVaultCatalog } from './useManagedVaultCatalog'
import { useMobileVaultSelection } from './useMobileVaultSelection'

vi.mock('./managedGitStorage', () => ({ managedGitSelection: vi.fn(), readManagedGitCatalog: vi.fn(), updateManagedGitCatalog: vi.fn() }))
vi.mock('./managedLocalStorage', () => ({ initializeLocalVaultCatalog: vi.fn(), managedLocalSelection: vi.fn() }))
vi.mock('../preloadNativeWorkspace', () => ({ preloadNativeWorkspace: vi.fn() }))

const vault = { id: 'saved-vault', label: 'Saved vault', repositoryUrl: 'https://github.com/example/vault.git' }
const catalog = { vaults: [vault], activeId: vault.id, localVaults: [], activeLocalId: null }
const selection = { catalogVaultId: vault.id, vaultAlias: 'saved-vault', vaultLabel: vault.label, vaultRootUri: 'file:///saved-vault' }
const roots: ReturnType<typeof createRoot>[] = []

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.resetAllMocks()
  vi.mocked(initializeLocalVaultCatalog).mockResolvedValue(catalog)
  vi.mocked(readManagedGitCatalog).mockResolvedValue(catalog)
  vi.mocked(managedGitSelection).mockResolvedValue(selection)
  vi.mocked(updateManagedGitCatalog).mockImplementation(async update => update(catalog))
  vi.mocked(preloadNativeWorkspace).mockResolvedValue(selection)
})
afterEach(async () => {
  for (const root of roots.splice(0)) await act(async () => root.unmount())
  vi.unstubAllGlobals()
})

describe('saved vault startup recovery', () => {
  it('distinguishes an unreadable registry from an inaccessible saved vault', async () => {
    vi.mocked(initializeLocalVaultCatalog).mockRejectedValue(new Error('catalogUnreadable'))
    const current = await mountCatalog()
    expect(current().error).toBe('catalog')
    expect(current().pending).toBe(false)
    expect(managedGitSelection).not.toHaveBeenCalled()
  })

  it('retains all saved entries when the active working copy cannot be opened', async () => {
    vi.mocked(managedGitSelection).mockRejectedValue(new Error('recoveryRequired'))
    const current = await mountCatalog()
    expect(current().vaults).toEqual([vault])
    expect(current().error).toBe('selection')
    expect(current().restored).toBeNull()
    expect(current().pending).toBe(false)
  })

  it('does not label a failed native index as catalog corruption', async () => {
    vi.mocked(preloadNativeWorkspace).mockRejectedValue(new Error('invalidTextFile'))
    const current = await mountCatalog()
    expect(current().error).toBe('selection')
    expect(current().vaults).toEqual([vault])
    expect(current().restored).toBeNull()
  })

  it('retries the active vault without replacing its catalog or files', async () => {
    vi.mocked(managedGitSelection).mockRejectedValueOnce(new Error('temporarilyUnavailable'))
    const current = await mountCatalog()
    await act(async () => { await current().retry() })
    expect(current().restored).toEqual({ git: vault, selection })
    expect(current().error).toBeNull()
    expect(current().vaults).toEqual([vault])
    expect(managedGitSelection).toHaveBeenCalledTimes(2)
  })

  it('reloading the list does not dismiss a failed restoration', async () => {
    vi.mocked(managedGitSelection).mockRejectedValue(new Error('recoveryRequired'))
    const current = await mountCatalog()
    await act(async () => { await current().reload() })
    expect(current().error).toBe('selection')
    expect(current().restored).toBeNull()
  })

  it('persists a normalized custom slug and refreshes the active selection', async () => {
    const current = await mountCatalog()
    vi.mocked(updateManagedGitCatalog).mockImplementation(async update => {
      return update(catalog)
    })
    await act(async () => { await current().updateAlias(vault.id, '  Laputa / Notes  ') })
    expect(current().vaults[0].alias).toBe('laputa-notes')
    expect(current().restored?.selection).toMatchObject({ catalogVaultId: vault.id, vaultAlias: 'laputa-notes' })
  })

  it('adds a stable suffix when a custom slug collides with another vault', async () => {
    const current = await mountCatalog()
    const collidingCatalog = { ...catalog, vaults: [vault, { ...vault, id: 'second', label: 'Laputa Notes' }] }
    vi.mocked(updateManagedGitCatalog).mockImplementation(async update => update(collidingCatalog))
    await act(async () => { await current().updateAlias(vault.id, 'Laputa Notes') })
    expect(current().vaults[0].alias).toBe('laputa-notes')
    expect(current().restored?.selection?.vaultAlias).toBe(
      mobileWorkspaceDeepLinkSlug(current().vaults[0], current().vaults),
    )
    expect(current().restored?.selection?.vaultAlias).toMatch(/^laputa-notes-[a-z0-9]{6}$/u)
  })

  it('uses the refreshed catalog slug for an active vault selection override', async () => {
    const secondVault = { ...vault, id: 'second-vault', label: 'Second vault', alias: 'old-second' }
    const twoVaultCatalog = { ...catalog, vaults: [vault, secondVault] }
    vi.mocked(initializeLocalVaultCatalog).mockResolvedValue(twoVaultCatalog)
    vi.mocked(readManagedGitCatalog).mockResolvedValue(twoVaultCatalog)
    vi.mocked(managedGitSelection).mockImplementation(async selected => ({
      ...selection,
      catalogVaultId: selected.id,
      vaultAlias: selected.alias ?? selected.label,
    }))
    vi.mocked(updateManagedGitCatalog).mockImplementation(async update => update(twoVaultCatalog))
    const current = await mountSelection()
    const activeSelection = {
      ...selection,
      catalogVaultId: secondVault.id,
      vaultAlias: 'old-second',
      selectedNoteId: 'note-1',
    }

    await act(async () => current().selection.setOverride({ git: secondVault, selection: activeSelection }))
    await act(async () => current().catalog.updateAlias(secondVault.id, 'new second'))

    expect(current().selection.active.selection).toMatchObject({
      catalogVaultId: secondVault.id,
      vaultAlias: 'new-second',
      selectedNoteId: 'note-1',
      vaultRootUri: activeSelection.vaultRootUri,
    })
    expect(current().selection.active.git).toMatchObject({ id: secondVault.id, alias: 'new-second' })
  })
})

async function mountCatalog() {
  const root = createRoot(document.createElement('div'))
  roots.push(root)
  let current: ReturnType<typeof useManagedVaultCatalog>
  function Probe() {
    const catalog = useManagedVaultCatalog()
    useEffect(() => { current = catalog }, [catalog])
    return null
  }
  await act(async () => root.render(createElement(Probe)))
  return () => current
}

async function mountSelection() {
  const root = createRoot(document.createElement('div'))
  roots.push(root)
  let current: {
    catalog: ReturnType<typeof useManagedVaultCatalog>
    selection: ReturnType<typeof useMobileVaultSelection>
  }
  function Probe() {
    const catalog = useManagedVaultCatalog()
    const selection = useMobileVaultSelection(catalog)
    useEffect(() => { current = { catalog, selection } }, [catalog, selection])
    return null
  }
  await act(async () => root.render(createElement(Probe)))
  return () => current
}
