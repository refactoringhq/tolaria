import { requireOptionalNativeModule } from 'expo'
import type {
  NativeWorkspaceAccessModule,
  NativeWorkspaceBridgeRecord,
  NativeWorkspaceIndex,
  NativeWorkspaceRecord,
} from './nativeWorkspaceAccess'

let cachedModule: NativeWorkspaceAccessModule | null | undefined

export function optionalNativeWorkspaceAccessModule(): NativeWorkspaceAccessModule | null {
  if (cachedModule !== undefined) return cachedModule
  cachedModule = requireOptionalNativeModule<NativeWorkspaceAccessModule>('TolariaWorkspaceAccess')
  return cachedModule
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

export type { NativeWorkspaceAccessModule } from './nativeWorkspaceAccess'
