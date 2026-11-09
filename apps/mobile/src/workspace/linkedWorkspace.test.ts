import { expect, it, vi } from 'vitest'
import { vaultSyncStatus } from '../components/vaults/useVaultSyncPresentation'
import { persistWorkspaceOperations } from './git/workspaceWriteQueue'
import { isWorkspaceLinked, syncLinkedWorkspace } from './linkedWorkspace'
import type { NativeWorkspaceAccessModule } from './nativeWorkspaceAccess'

function nativeModule(
  sync: NonNullable<NativeWorkspaceAccessModule['syncLinkedWorkspace']>,
): NativeWorkspaceAccessModule {
  return {
    importWorkspace: async () => null,
    restoreWorkspace: async () => null,
    isWorkspaceLinked: () => true,
    syncLinkedWorkspace: sync,
  }
}

it('distinguishes linked folders from historical copies and unsupported platforms', () => {
  expect(isWorkspaceLinked('root', null)).toBe(false)
  expect(isWorkspaceLinked(undefined, nativeModule(vi.fn()))).toBe(false)
  expect(isWorkspaceLinked('root', nativeModule(vi.fn()))).toBe(true)
})

it('waits for local saves before reconciling and preserves the native conflict result', async () => {
  const order: string[] = []
  const root = 'linked-sync-save-order'
  const write = persistWorkspaceOperations(root, [
    async () => {
      order.push('save')
    },
  ])
  const result = await syncLinkedWorkspace(
    root,
    nativeModule(async () => {
      order.push('sync')
      return { linked: true, changed: false, conflict: true }
    }),
  )
  await write
  expect(order).toEqual(['save', 'sync'])
  expect(result.conflict).toBe(true)
})

it('reports inaccessible folders without claiming a successful sync', async () => {
  await expect(syncLinkedWorkspace('root', null)).rejects.toThrow('linkedFolderUnavailable')
  await expect(
    syncLinkedWorkspace(
      'root',
      nativeModule(async () => {
        throw new Error('permission revoked')
      }),
    ),
  ).rejects.toThrow('linkedFolderUnavailable')
})

it('labels folder persistence separately from cloud delivery and still exposes errors', () => {
  const sync = { kind: 'synced', minutesAgo: 0 } as const
  expect(vaultSyncStatus(false, 'synced', sync, true).label).toBe('Saved to folder')
  expect(vaultSyncStatus(false, 'synced', sync).label).toBe('Local only')
  expect(vaultSyncStatus(false, 'diverged', sync, true).label).toBe('Conflict')
})
