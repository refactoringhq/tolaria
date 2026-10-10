import { describe, expect, it, vi } from 'vitest'
import {
  nativeWorkspaceSelectionFromDirectory,
  pickNativeWorkspaceDirectoryWithDependencies,
  pickNativeWorkspaceDirectoryWithPicker,
  restoreNativeWorkspaceDirectory,
} from './nativeWorkspacePicker'
import type { NativeWorkspaceAccessModule } from './nativeWorkspaceAccess'

describe('native workspace picker', () => {
  const managedLaputaRecord = {
    index: {
      directories: ['Writing'],
      files: [{
        absolutePath: 'file:///managed/Tolaria%20Vault/Writing/Launch%20note.md',
        content: '# Launch note\n',
        createdAt: null,
        modifiedAt: 2,
        relativePath: 'Writing/Launch note.md',
        size: 14,
      }],
    },
    label: 'Laputa',
    uri: 'file:///managed/Tolaria%20Vault/',
  }
  const managedLaputaSelection = {
    index: managedLaputaRecord.index,
    vaultAlias: 'laputa',
    vaultLabel: 'Laputa',
    vaultRootUri: managedLaputaRecord.uri,
  }

  function accessModule(
    overrides: Partial<NativeWorkspaceAccessModule> = {},
  ): NativeWorkspaceAccessModule {
    return {
      importWorkspace: vi.fn(),
      restoreWorkspace: vi.fn(),
      ...overrides,
    }
  }

  it('builds native repository requests from picked directories', () => {
    expect(nativeWorkspaceSelectionFromDirectory({
      name: 'Laputa',
      uri: 'file:///Users/luca/Laputa/',
    })).toEqual({
      vaultAlias: 'laputa',
      vaultLabel: 'Laputa',
      vaultRootUri: 'file:///Users/luca/Laputa/',
    })
  })

  it('derives a decoded vault label when the picker omits a directory name', () => {
    expect(nativeWorkspaceSelectionFromDirectory({
      uri: 'file:///Users/luca/Work%20Vault/',
    })).toEqual({
      vaultAlias: 'work-vault',
      vaultLabel: 'Work Vault',
      vaultRootUri: 'file:///Users/luca/Work%20Vault/',
    })
  })

  it('treats picker cancellation as no selected vault', async () => {
    await expect(pickNativeWorkspaceDirectoryWithPicker(async () => {
      throw new Error('cancelled')
    })).resolves.toBeNull()
  })

  it('keeps picked directories session-scoped when the import module is unavailable', async () => {
    await expect(pickNativeWorkspaceDirectoryWithPicker(async () => ({
      name: 'Laputa',
      uri: 'file:///Users/luca/Laputa/',
    }))).resolves.toEqual({
      vaultAlias: 'laputa',
      vaultLabel: 'Laputa',
      vaultRootUri: 'file:///Users/luca/Laputa/',
    })
  })

  it('uses the standalone native picker without invoking Expo file-system APIs', async () => {
    const pickDirectory = vi.fn()
    const module = accessModule({
      pickAndImportWorkspace: vi.fn().mockResolvedValue(managedLaputaRecord),
    })

    await expect(pickNativeWorkspaceDirectoryWithDependencies(pickDirectory, module))
      .resolves.toEqual(managedLaputaSelection)
    expect(pickDirectory).not.toHaveBeenCalled()
  })

  it('falls back to the Expo picker when the native picker is unavailable', async () => {
    const pickDirectory = vi.fn().mockResolvedValue({ name: 'Laputa', uri: 'file:///Laputa/' })
    const module = accessModule({
      importWorkspace: vi.fn().mockResolvedValue(managedLaputaRecord),
    })

    await expect(pickNativeWorkspaceDirectoryWithDependencies(pickDirectory, module))
      .resolves.toEqual(managedLaputaSelection)
    expect(pickDirectory).toHaveBeenCalledOnce()
  })

  it('does not open the original folder when a managed import fails', async () => {
    const pickDirectory = vi.fn().mockResolvedValue({ name: 'Laputa', uri: 'file:///original/' })
    const module = accessModule({ importWorkspace: vi.fn().mockResolvedValue(null) })
    await expect(pickNativeWorkspaceDirectoryWithDependencies(pickDirectory, module))
      .rejects.toThrow('workspaceImportFailed')
  })

  it('uses session access only when no native importer exists', async () => {
    const pickDirectory = vi.fn().mockResolvedValue({ name: 'Laputa', uri: 'file:///original/' })
    await expect(pickNativeWorkspaceDirectoryWithDependencies(pickDirectory, null))
      .resolves.toMatchObject({ vaultRootUri: 'file:///original/' })
  })

  it('restores a managed native workspace without reopening the picker', async () => {
    const module = accessModule({
      pickAndImportWorkspace: vi.fn().mockResolvedValue(null),
      restoreWorkspace: vi.fn().mockResolvedValue({
        index: managedLaputaRecord.index,
        label: 'Work Vault',
        uri: 'file:///managed/Tolaria%20Vault/',
      }),
    })

    await expect(restoreNativeWorkspaceDirectory(module)).resolves.toEqual({
      index: managedLaputaRecord.index,
      vaultAlias: 'work-vault',
      vaultLabel: 'Work Vault',
      vaultRootUri: 'file:///managed/Tolaria%20Vault/',
    })
  })
})
