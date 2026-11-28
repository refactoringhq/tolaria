// @vitest-environment jsdom
import { act, createElement, useLayoutEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { usePreparedVaultRefresh } from './usePreparedVaultRefresh'
import type { ActiveVault } from './useManagedVaultCatalog'
import { prepareNativeWorkspace } from '../prepareNativeWorkspace'
import { optionalNativeWorkspaceAccessModule } from '../nativeWorkspaceAccess'
import { rememberPreparedWorkspaceSnapshot, takePreparedWorkspaceSnapshot } from '../preparedWorkspaceSnapshot'
import { buildLocalVaultWorkspaceSnapshot } from '../localVaultSnapshot'

vi.mock('../prepareNativeWorkspace', () => ({ prepareNativeWorkspace: vi.fn() }))
vi.mock('../nativeWorkspaceAccess', () => ({ optionalNativeWorkspaceAccessModule: vi.fn() }))
const roots: ReturnType<typeof createRoot>[] = []

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.resetAllMocks()
})
afterEach(async () => {
  for (const root of roots.splice(0)) await act(async () => root.unmount())
  vi.unstubAllGlobals()
})

it('discards the consumed index and waits for fresh preparation before publishing', async () => {
  const old = fixture()
  const fresh = fixture()
  const pending = deferred<ActiveVault['selection']>()
  vi.mocked(prepareNativeWorkspace).mockReturnValue(pending.promise)
  const probe = await mountRefresh()
  let operation: Promise<void>
  await act(async () => { operation = probe.current.refresh(old.vault, old.vault, 'notes/one.md') })
  expect(prepareNativeWorkspace).toHaveBeenCalledExactlyOnceWith({ ...old.vault.selection, index: undefined })
  expect(probe.publish).not.toHaveBeenCalled()
  fresh.remember()
  await act(async () => { pending.resolve(fresh.vault.selection); await operation })
  expect(probe.publish).toHaveBeenCalledExactlyOnceWith({ ...fresh.vault,
    selection: { ...fresh.vault.selection, selectedNoteId: 'notes/one.md' } })
  expect(takePreparedWorkspaceSnapshot(fresh.index, fresh.options)).toBe(fresh.snapshot)
})

it('reuses an unconsumed prepared handoff without indexing twice', async () => {
  const next = fixture()
  next.remember()
  const probe = await mountRefresh()
  await act(async () => probe.current.refresh(next.vault, next.vault))
  expect(prepareNativeWorkspace).not.toHaveBeenCalled()
  expect(probe.publish).toHaveBeenCalledOnce()
  expect(takePreparedWorkspaceSnapshot(next.index, next.options)).toBe(next.snapshot)
})

it('keeps recovery visible during retry and never publishes failed or unprepared source', async () => {
  const old = fixture()
  vi.mocked(prepareNativeWorkspace).mockRejectedValueOnce(new Error('index failed'))
  const probe = await mountRefresh()
  await act(async () => {
    await expect(probe.current.refresh(old.vault, old.vault, 'notes/one.md')).rejects.toThrow('index failed')
  })
  expect(probe.current.failed).toBe(true)
  expect(probe.publish).not.toHaveBeenCalled()
  const pending = deferred<ActiveVault['selection']>()
  vi.mocked(prepareNativeWorkspace).mockReturnValue(pending.promise)
  let operation: Promise<void>
  await act(async () => { operation = probe.current.refresh(old.vault, old.vault) })
  expect(probe.current.failed).toBe(true)
  const fresh = fixture()
  fresh.remember()
  await act(async () => { pending.resolve(fresh.vault.selection); await operation })
  expect(probe.current.failed).toBe(false)
  expect(probe.publish).toHaveBeenCalledExactlyOnceWith({ ...fresh.vault,
    selection: { ...fresh.vault.selection, selectedNoteId: 'notes/one.md' } })
})

it.each([null, fixture().vault.selection])('fails closed if preparation returns no authoritative handoff', async selection => {
  vi.mocked(optionalNativeWorkspaceAccessModule).mockReturnValue({} as never)
  vi.mocked(prepareNativeWorkspace).mockResolvedValue(selection)
  const next = fixture().vault
  const probe = await mountRefresh()
  await act(async () => { await expect(probe.current.refresh(next, next)).rejects.toThrow('workspacePreparationMissing') })
  expect(probe.current.failed).toBe(true)
  expect(probe.publish).not.toHaveBeenCalled()
})

it('keeps the selection without a native index when no native workspace module exists (Android)', async () => {
  vi.mocked(optionalNativeWorkspaceAccessModule).mockReturnValue(null)
  const next = fixture().vault
  vi.mocked(prepareNativeWorkspace).mockResolvedValue(next.selection)
  const probe = await mountRefresh()
  await act(async () => probe.current.refresh(next, next))
  expect(probe.publish).toHaveBeenCalledOnce()
  expect(probe.publish.mock.calls[0][0].selection).toMatchObject({ vaultRootUri: next.selection?.vaultRootUri, index: undefined })
  expect(probe.current.failed).toBe(false)
})

it('still rejects a missing selection without a native module', async () => {
  vi.mocked(optionalNativeWorkspaceAccessModule).mockReturnValue(null)
  vi.mocked(prepareNativeWorkspace).mockResolvedValue(null)
  const next = fixture().vault
  const probe = await mountRefresh()
  await act(async () => { await expect(probe.current.refresh(next, next)).rejects.toThrow('workspacePreparationMissing') })
  expect(probe.publish).not.toHaveBeenCalled()
})

it('does not transfer selection across roots, and handles forgetting the active vault without indexing', async () => {
  const previous = fixture().vault
  const next = fixture('file:///other')
  next.remember()
  const probe = await mountRefresh()
  await act(async () => probe.current.refresh(next.vault, previous, 'notes/one.md'))
  expect(probe.publish.mock.calls[0][0].selection?.selectedNoteId).toBeUndefined()
  const empty = { selection: null, git: null }
  await act(async () => probe.current.refresh(empty, previous))
  expect(probe.publish).toHaveBeenLastCalledWith(empty)
  expect(prepareNativeWorkspace).not.toHaveBeenCalled()
})

async function mountRefresh() {
  const root = createRoot(document.createElement('div'))
  roots.push(root)
  const publish = vi.fn<(value: ActiveVault) => void>()
  let current: ReturnType<typeof usePreparedVaultRefresh>
  function Probe() {
    const value = usePreparedVaultRefresh(publish)
    useLayoutEffect(() => { current = value }, [value])
    return null
  }
  await act(async () => root.render(createElement(Probe)))
  return { get current() { return current }, publish }
}

function fixture(root = 'file:///refresh') {
  const index = { directories: [], files: [] }
  const selection = { index, vaultAlias: 'fixture', vaultLabel: 'Fixture', vaultRootUri: root }
  const options = { files: index.files, folderPaths: index.directories, vaultAlias: selection.vaultAlias,
    vaultLabel: selection.vaultLabel, vaultPath: root }
  const snapshot = buildLocalVaultWorkspaceSnapshot(options)
  return { vault: { selection, git: null }, index, options, snapshot,
    remember: () => rememberPreparedWorkspaceSnapshot(index, options, snapshot) }
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>(yes => { resolve = yes })
  return { promise, resolve }
}
