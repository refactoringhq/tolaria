import type { WorkspaceFileIndex } from './fileSystemWorkspaceRepository'

export type NativeWorkspaceAccessModule = {
  importWorkspace: (uri: string) => Promise<NativeWorkspaceBridgeRecord | null>
  pickAndImportWorkspace?: () => Promise<NativeWorkspaceBridgeRecord | null>
  restoreWorkspace: () => Promise<NativeWorkspaceBridgeRecord | null>
}

export type NativeWorkspaceIndex = WorkspaceFileIndex
export type NativeWorkspaceRecord = { index?: NativeWorkspaceIndex; label: string; uri: string }
export type NativeWorkspaceBridgeRecord = NativeWorkspaceRecord & { indexJson?: string }

export function optionalNativeWorkspaceAccessModule(): NativeWorkspaceAccessModule | null {
  return null
}

export async function importNativeWorkspace(
  uri: string,
  module: NativeWorkspaceAccessModule | null = optionalNativeWorkspaceAccessModule(),
): Promise<NativeWorkspaceRecord | null> {
  if (!module) return null

  try {
    return normalizedWorkspaceRecord(await module.importWorkspace(uri))
  } catch {
    return null
  }
}

export async function pickAndImportNativeWorkspace(
  module: NativeWorkspaceAccessModule | null = optionalNativeWorkspaceAccessModule(),
): Promise<NativeWorkspaceRecord | null> {
  if (!module?.pickAndImportWorkspace) return null

  return normalizedWorkspaceRecord(await module.pickAndImportWorkspace())
}

export async function restoreNativeWorkspace(
  module: NativeWorkspaceAccessModule | null = optionalNativeWorkspaceAccessModule(),
): Promise<NativeWorkspaceRecord | null> {
  if (!module) return null

  return normalizedWorkspaceRecord(await module.restoreWorkspace())
}

function normalizedWorkspaceRecord(record: NativeWorkspaceBridgeRecord | null): NativeWorkspaceRecord | null {
  const uri = record?.uri.trim()
  const label = record?.label.trim()
  if (!uri || !label) return null
  const index = record?.index ?? parsedWorkspaceIndex(record?.indexJson)
  return index ? { index, label, uri } : { label, uri }
}

function parsedWorkspaceIndex(value: string | undefined): NativeWorkspaceIndex | undefined {
  if (!value) return undefined
  try {
    const candidate = JSON.parse(value) as Partial<NativeWorkspaceIndex>
    return Array.isArray(candidate.directories) && Array.isArray(candidate.files)
      ? { directories: candidate.directories, files: candidate.files }
      : undefined
  } catch {
    return undefined
  }
}
