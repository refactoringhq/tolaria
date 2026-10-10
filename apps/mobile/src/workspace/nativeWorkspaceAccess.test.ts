import { describe, expect, it, vi } from 'vitest'
import {
  importNativeWorkspace,
  pickAndImportNativeWorkspace,
  restoreNativeWorkspace,
  type NativeWorkspaceIndex,
  type NativeWorkspaceAccessModule,
} from './nativeWorkspaceAccess'

describe('native workspace access', () => {
  it('keeps Expo Go selections session-scoped when the native module is unavailable', async () => {
    await expect(importNativeWorkspace('file:///vault', null)).resolves.toBeNull()
    await expect(restoreNativeWorkspace(null)).resolves.toBeNull()
  })

  it('remembers a picked workspace in standalone iOS builds', async () => {
    const module: NativeWorkspaceAccessModule = {
      importWorkspace: vi.fn().mockResolvedValue({ label: 'Vault', uri: 'file:///managed-vault' }),
      pickAndImportWorkspace: vi.fn().mockResolvedValue(null),
      restoreWorkspace: vi.fn().mockResolvedValue(null),
    }

    await expect(importNativeWorkspace('file:///vault', module)).resolves.toEqual({
      label: 'Vault',
      uri: 'file:///managed-vault',
    })
    expect(module.importWorkspace).toHaveBeenCalledWith('file:///vault')
  })

  it('imports a workspace selected by the standalone iOS picker', async () => {
    const module: NativeWorkspaceAccessModule = {
      importWorkspace: vi.fn(),
      pickAndImportWorkspace: vi.fn().mockResolvedValue({
        label: 'Laputa',
        uri: 'file:///managed/Tolaria%20Vault/',
      }),
      restoreWorkspace: vi.fn(),
    }

    await expect(pickAndImportNativeWorkspace(module)).resolves.toEqual({
      label: 'Laputa',
      uri: 'file:///managed/Tolaria%20Vault/',
    })
  })

  it('distinguishes native import failure from picker cancellation', async () => {
    const module: NativeWorkspaceAccessModule = {
      importWorkspace: vi.fn(),
      pickAndImportWorkspace: vi.fn().mockRejectedValue(new Error('unreadable note')),
      restoreWorkspace: vi.fn(),
    }
    await expect(pickAndImportNativeWorkspace(module)).rejects.toThrow('unreadable note')
    module.pickAndImportWorkspace = vi.fn().mockResolvedValue(null)
    await expect(pickAndImportNativeWorkspace(module)).resolves.toBeNull()
  })

  it('restores a persisted workspace URI and rejects malformed native results', async () => {
    const index: NativeWorkspaceIndex = {
      directories: ['Writing'],
      files: [{
        absolutePath: 'file:///vault/Writing/Indexed%20note.md',
        content: '# Indexed note\n',
        createdAt: 1,
        modifiedAt: 2,
        relativePath: 'Writing/Indexed note.md',
        size: 15,
      }],
    }
    const restored: NativeWorkspaceAccessModule = {
      importWorkspace: vi.fn(),
      restoreWorkspace: vi.fn().mockResolvedValue({ index, label: 'Vault', uri: 'file:///vault' }),
    }
    const malformed: NativeWorkspaceAccessModule = {
      importWorkspace: vi.fn(),
      restoreWorkspace: vi.fn().mockResolvedValue({ label: ' ', uri: '  ' }),
    }

    await expect(restoreNativeWorkspace(restored)).resolves.toEqual({ index, label: 'Vault', uri: 'file:///vault' })
    await expect(restoreNativeWorkspace(malformed)).resolves.toBeNull()
  })

  it('decodes the workspace index returned by the native bridge', async () => {
    const index: NativeWorkspaceIndex = {
      directories: ['Writing'],
      files: [{
        absolutePath: 'file:///vault/Writing/Indexed%20note.md',
        content: '# Indexed note\n',
        createdAt: 1,
        modifiedAt: 2,
        relativePath: 'Writing/Indexed note.md',
        size: 15,
      }],
    }
    const module: NativeWorkspaceAccessModule = {
      importWorkspace: vi.fn(),
      restoreWorkspace: vi.fn().mockResolvedValue({
        indexJson: JSON.stringify(index),
        label: 'Vault',
        uri: 'file:///vault',
      }),
    }

    await expect(restoreNativeWorkspace(module)).resolves.toEqual({
      index,
      label: 'Vault',
      uri: 'file:///vault',
    })
  })

  it('rejects failed restoration without turning it into a first launch', async () => {
    const module: NativeWorkspaceAccessModule = {
      importWorkspace: vi.fn().mockRejectedValue(new Error('import failed')),
      restoreWorkspace: vi.fn().mockRejectedValue(new Error('permission revoked')),
    }

    await expect(importNativeWorkspace('file:///vault', module)).resolves.toBeNull()
    await expect(restoreNativeWorkspace(module)).rejects.toThrow('permission revoked')
  })
})
