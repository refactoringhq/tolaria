import { mobileWorkspaceAlias } from './mobileWorkspaceAlias'
import {
  importNativeWorkspace,
  optionalNativeWorkspaceAccessModule,
  pickAndImportNativeWorkspace,
  restoreNativeWorkspace,
  type NativeWorkspaceAccessModule,
} from './nativeWorkspaceAccess'
import type { NativeWorkspaceIndex } from './nativeWorkspaceAccess'

export type NativeWorkspaceSelection = {
  selectedNoteId?: string
  index?: NativeWorkspaceIndex
  vaultAlias: string | null
  vaultLabel: string
  vaultRootUri: string
}

type PickedWorkspaceDirectory = {
  index?: NativeWorkspaceIndex
  name?: string | null
  uri?: string | null
}

type WorkspaceDirectoryPicker = (initialUri?: string) => Promise<PickedWorkspaceDirectory>
type ExpoFileSystemPickerModule = {
  Directory: {
    pickDirectoryAsync: WorkspaceDirectoryPicker
  }
}

declare const require: (moduleName: string) => ExpoFileSystemPickerModule

let expoFileSystemModule: ExpoFileSystemPickerModule | null = null

export async function pickNativeWorkspaceDirectory(
  initialUri?: string | null,
  module: NativeWorkspaceAccessModule | null = optionalNativeWorkspaceAccessModule(),
): Promise<NativeWorkspaceSelection | null> {
  return pickNativeWorkspaceDirectoryWithDependencies(
    expoFileSystem().Directory.pickDirectoryAsync,
    module,
    initialUri,
  )
}

export async function pickNativeWorkspaceDirectoryWithDependencies(
  pickDirectory: WorkspaceDirectoryPicker,
  module: NativeWorkspaceAccessModule | null,
  initialUri?: string | null,
): Promise<NativeWorkspaceSelection | null> {
  if (module?.pickAndImportWorkspace) {
    const imported = await pickAndImportNativeWorkspace(module)
    return imported
      ? nativeWorkspaceSelectionFromDirectory({ index: imported.index, name: imported.label, uri: imported.uri })
      : null
  }

  const picked = await pickNativeWorkspaceDirectoryWithPicker(pickDirectory, initialUri ?? undefined)
  if (!picked) return null

  const imported = await importNativeWorkspace(picked.vaultRootUri, module)
  return imported
    ? nativeWorkspaceSelectionFromDirectory({ index: imported.index, name: imported.label, uri: imported.uri })
    : picked
}

export async function restoreNativeWorkspaceDirectory(
  module?: NativeWorkspaceAccessModule | null,
): Promise<NativeWorkspaceSelection | null> {
  const restored = await restoreNativeWorkspace(module)
  return restored
    ? nativeWorkspaceSelectionFromDirectory({ index: restored.index, name: restored.label, uri: restored.uri })
    : null
}

export async function pickNativeWorkspaceDirectoryWithPicker(
  pickDirectory: WorkspaceDirectoryPicker,
  initialUri?: string,
): Promise<NativeWorkspaceSelection | null> {
  try {
    return nativeWorkspaceSelectionFromDirectory(await pickDirectory(initialUri))
  } catch {
    return null
  }
}

export function nativeWorkspaceSelectionFromDirectory(
  directory: PickedWorkspaceDirectory,
): NativeWorkspaceSelection | null {
  const vaultRootUri = directory.uri?.trim()
  if (!vaultRootUri) return null

  const vaultLabel = directory.name?.trim() || fallbackWorkspaceLabel(vaultRootUri)
  return {
    ...(directory.index ? { index: directory.index } : {}),
    vaultAlias: mobileWorkspaceAlias({ label: vaultLabel, path: vaultRootUri }),
    vaultLabel,
    vaultRootUri,
  }
}

function expoFileSystem(): ExpoFileSystemPickerModule {
  expoFileSystemModule ??= require('expo-file-system')
  return expoFileSystemModule
}

function fallbackWorkspaceLabel(uri: string) {
  const segment = uri.replace(/\/+$/u, '').split('/').filter(Boolean).at(-1)
  if (!segment) return 'Tolaria Vault'

  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}
