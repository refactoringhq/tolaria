import { buildLocalVaultWorkspaceSnapshot, type LocalVaultFile } from './localVaultSnapshot'
import type { MobileNote, MobileVaultConfig, MobileWorkspaceSnapshot } from './mobileWorkspaceModel'
import type { MobileWorkspaceWrite } from './mobileWorkspaceEditing'
import type { ReadOnlyWorkspaceRepository, ReadOnlyWorkspaceRequest } from './readOnlyWorkspaceRepository'
import { persistWorkspaceOperations } from './git/workspaceWriteQueue'

export type WorkspaceFileSystem = {
  createDirectory: (rootUri: string, relativePath: string) => void
  deleteDirectory: (rootUri: string, relativePath: string) => void
  deleteTextFile: (rootUri: string, relativePath: string) => void
  moveDirectory: (rootUri: string, fromRelativePath: string, toRelativePath: string) => void
  moveTextFile: (rootUri: string, fromRelativePath: string, toRelativePath: string) => void
  readVaultConfig?: (rootUri: string) => MobileVaultConfig | null
  readVaultDirectories: (rootUri: string) => string[]
  readTextFile: (rootUri: string, relativePath: string) => string | null
  readVaultFiles: (rootUri: string) => LocalVaultFile[]
  writeVaultConfig?: (rootUri: string, config: MobileVaultConfig) => void
  writeTextFile: (rootUri: string, relativePath: string, content: string) => void
}

export type WorkspaceFileIndex = {
  directories: string[]
  files: LocalVaultFile[]
}

export function createFileSystemWorkspaceRepository(fileSystem: WorkspaceFileSystem): ReadOnlyWorkspaceRepository {
  return {
    persistWrites: async (writes, request) => {
      const rootUri = workspaceRootUri(request)
      if (!rootUri) return

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
    if (write.config) fileSystem.writeVaultConfig?.(rootUri, write.config)
    return
  }

  const relativePath = normalizedWorkspaceRelativePath(write.path)
  if (!relativePath) return

  if (isDeleteTextWrite(write)) {
    fileSystem.deleteTextFile(rootUri, relativePath)
    return
  }

  if (write.kind === 'createFolder') {
    fileSystem.createDirectory(rootUri, relativePath)
    return
  }

  if (write.kind === 'deleteFolder') {
    fileSystem.deleteDirectory(rootUri, relativePath)
    return
  }

  persistMoveOrTextWrite(fileSystem, rootUri, relativePath, write)
}

function persistMoveOrTextWrite(
  fileSystem: WorkspaceFileSystem,
  rootUri: string,
  relativePath: string,
  write: Extract<MobileWorkspaceWrite, { kind: 'createNote' | 'moveNote' | 'renameFolder' | 'saveNote' | 'saveView' }>,
) {
  if (write.kind === 'moveNote') {
    const toRelativePath = normalizedWorkspaceRelativePath(write.toPath)
    if (toRelativePath) fileSystem.moveTextFile(rootUri, relativePath, toRelativePath)
    return
  }

  if (write.kind === 'renameFolder') {
    const toRelativePath = normalizedWorkspaceRelativePath(write.toPath)
    if (toRelativePath) fileSystem.moveDirectory(rootUri, relativePath, toRelativePath)
    return
  }

  fileSystem.writeTextFile(rootUri, relativePath, write.content)
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

export function normalizedWorkspaceRelativePath(path: string): string | null {
  const normalized = path.replaceAll('\\', '/').trim()
  if (!normalized || normalized.startsWith('/') || normalized.includes('://')) return null

  const parts = normalized.split('/').filter(Boolean)
  if (parts.some((part) => part === '.' || part === '..')) return null

  return parts.join('/')
}
