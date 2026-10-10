import { buildLocalVaultWorkspaceSnapshot, type LocalVaultFile } from './localVaultSnapshot'
import type { MobileNote, MobileVaultConfig, MobileWorkspaceSnapshot } from './mobileWorkspaceModel'
import type { MobileWorkspaceWrite } from './mobileWorkspaceEditing'
import type { ReadOnlyWorkspaceRepository, ReadOnlyWorkspaceRequest } from './readOnlyWorkspaceRepository'
import { persistWorkspaceOperations } from './git/workspaceWriteQueue'
import { normalizedWorkspaceRelativePath, requireWorkspaceWritePath, validateWorkspaceWrites } from './workspaceWriteValidation'
export { normalizedWorkspaceRelativePath } from './workspaceWriteValidation'

type WorkspaceMutation = void | Promise<void>

export type WorkspaceFileSystem = {
  createDirectory: (rootUri: string, relativePath: string) => WorkspaceMutation
  deleteDirectory: (rootUri: string, relativePath: string) => WorkspaceMutation
  deleteTextFile: (rootUri: string, relativePath: string) => WorkspaceMutation
  moveDirectory: (rootUri: string, fromRelativePath: string, toRelativePath: string) => WorkspaceMutation
  moveTextFile: (rootUri: string, fromRelativePath: string, toRelativePath: string) => WorkspaceMutation
  readVaultConfig?: (rootUri: string) => MobileVaultConfig | null
  readVaultDirectories: (rootUri: string) => string[]
  readTextFile: (rootUri: string, relativePath: string) => string | null
  readVaultFiles: (rootUri: string) => LocalVaultFile[]
  writeVaultConfig?: (rootUri: string, config: MobileVaultConfig) => WorkspaceMutation
  writeTextFile: (rootUri: string, relativePath: string, content: string) => WorkspaceMutation
}

export type WorkspaceFileIndex = {
  directories: string[]
  files: LocalVaultFile[]
}

export function createFileSystemWorkspaceRepository(fileSystem: WorkspaceFileSystem): ReadOnlyWorkspaceRepository {
  return {
    persistWrites: async (writes, request) => {
      if (writes.length === 0) return
      const rootUri = workspaceRootUri(request)
      if (!rootUri) throw new Error('workspaceNotSelected')
      validateWorkspaceWrites(writes)

      await persistWorkspaceOperations(rootUri, writes.map((write) => () => persistWorkspaceWrite(fileSystem, rootUri, write)))
    },
    readNoteContent: async (note, request) => {
      if (note.rawContent !== undefined) return note.rawContent

      const rootUri = workspaceRootUri(request)
      const relativePath = noteRelativePath(note)
      if (!rootUri || !relativePath) return null

      return fileSystem.readTextFile(rootUri, relativePath)
    },
    readSnapshot: (request) => {
      const rootUri = workspaceRootUri(request)
      if (!rootUri) return emptyFileSystemSnapshot(request)

      const index = request?.workspaceIndex

      return buildLocalVaultWorkspaceSnapshot({
        files: index?.files ?? fileSystem.readVaultFiles(rootUri),
        folderPaths: index?.directories ?? fileSystem.readVaultDirectories(rootUri),
        vaultConfig: fileSystem.readVaultConfig?.(rootUri) ?? null,
        vaultAlias: request?.vaultAlias,
        vaultLabel: workspaceLabel(rootUri, request),
        vaultPath: rootUri,
      })
    },
  }
}

function persistWorkspaceWrite(
  fileSystem: WorkspaceFileSystem,
  rootUri: string,
  write: MobileWorkspaceWrite,
) {
  if (write.kind === 'saveVaultConfig') {
    return persistVaultConfig(fileSystem, rootUri, write.config)
  }

  const relativePath = requireWorkspaceWritePath(write.path)

  if (isDeleteTextWrite(write)) {
    return fileSystem.deleteTextFile(rootUri, relativePath)
  }

  if (write.kind === 'createFolder') {
    return fileSystem.createDirectory(rootUri, relativePath)
  }

  if (write.kind === 'deleteFolder') {
    return fileSystem.deleteDirectory(rootUri, relativePath)
  }

  return persistMoveOrTextWrite(fileSystem, rootUri, relativePath, write)
}

function persistVaultConfig(fileSystem: WorkspaceFileSystem, rootUri: string, config?: MobileVaultConfig) {
  if (!config || !fileSystem.writeVaultConfig) throw new Error('unsupportedWorkspaceConfig')
  return fileSystem.writeVaultConfig(rootUri, config)
}

function persistMoveOrTextWrite(
  fileSystem: WorkspaceFileSystem,
  rootUri: string,
  relativePath: string,
  write: Extract<MobileWorkspaceWrite, { kind: 'createNote' | 'moveNote' | 'renameFolder' | 'saveNote' | 'saveView' }>,
) {
  if (write.kind === 'moveNote') {
    return fileSystem.moveTextFile(rootUri, relativePath, requireWorkspaceWritePath(write.toPath))
  }

  if (write.kind === 'renameFolder') {
    return fileSystem.moveDirectory(rootUri, relativePath, requireWorkspaceWritePath(write.toPath))
  }

  return fileSystem.writeTextFile(rootUri, relativePath, write.content)
}

function isDeleteTextWrite(
  write: MobileWorkspaceWrite,
): write is Extract<MobileWorkspaceWrite, { kind: 'deleteNote' | 'deleteView' }> {
  return write.kind === 'deleteNote' || write.kind === 'deleteView'
}

function workspaceRootUri(request?: ReadOnlyWorkspaceRequest): string | null {
  return request?.vaultRootUri ?? null
}

function workspaceLabel(rootUri: string, request?: ReadOnlyWorkspaceRequest) {
  const directoryName = rootUri.split('/').filter(Boolean).at(-1)
  return request?.vaultLabel?.trim() || decodedDirectoryName(directoryName) || 'Tolaria Vault'
}

function decodedDirectoryName(directoryName: string | undefined) {
  if (!directoryName) return ''

  try {
    return decodeURIComponent(directoryName)
  } catch {
    return directoryName
  }
}

function emptyFileSystemSnapshot(request?: ReadOnlyWorkspaceRequest): MobileWorkspaceSnapshot {
  const snapshot = buildLocalVaultWorkspaceSnapshot({
    files: [],
    vaultAlias: request?.vaultAlias,
    vaultLabel: request?.vaultLabel ?? 'Tolaria Vault',
    vaultPath: request?.vaultRootUri ?? '',
  })

  return {
    ...snapshot,
    sync: { kind: 'noVault' },
  }
}

function noteRelativePath(note: MobileNote): string | null {
  return normalizedWorkspaceRelativePath(note.path ?? note.id)
}
