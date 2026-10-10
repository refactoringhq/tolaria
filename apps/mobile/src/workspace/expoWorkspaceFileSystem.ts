import type { Directory, File, Paths } from 'expo-file-system'
import { mobileFileKindForPath, type LocalVaultFile } from './localVaultSnapshot'
import {
  parseMobileVaultConfig,
  serializeMobileVaultConfig,
} from './mobileVaultConfig'
import { normalizedWorkspaceRelativePath, type WorkspaceFileSystem } from './fileSystemWorkspaceRepository'
import { requireWorkspaceWritePath } from './workspaceWriteValidation'

type ExpoFileSystemModule = {
  Directory: typeof Directory
  File: typeof File
  Paths: typeof Paths
}
type DirectoryName = string
type RelativeVaultPath = string
type RootUri = string
type MovableWorkspaceEntry = Directory | File

declare const require: (moduleName: string) => ExpoFileSystemModule

let expoFileSystemModule: ExpoFileSystemModule | null = null

export const expoWorkspaceFileSystem: WorkspaceFileSystem = {
  createDirectory: (rootUri, relativePath) => {
    const normalizedPath = requireWorkspaceWritePath(relativePath)

    workspaceDirectory(expoFileSystem(), rootUri, normalizedPath).create({ idempotent: true, intermediates: true })
  },
  deleteDirectory: (rootUri, relativePath) => {
    const normalizedPath = requireWorkspaceWritePath(relativePath)

    const directory = workspaceDirectory(expoFileSystem(), rootUri, normalizedPath)
    if (directory.exists) directory.delete()
  },
  deleteTextFile: (rootUri, relativePath) => {
    const normalizedPath = requireWorkspaceWritePath(relativePath)

    const file = workspaceFile(expoFileSystem(), rootUri, normalizedPath)
    if (file.exists) file.delete()
  },
  moveDirectory: (rootUri, fromRelativePath, toRelativePath) => {
    moveWorkspaceEntry(rootUri, fromRelativePath, toRelativePath, workspaceDirectory)
  },
  moveTextFile: (rootUri, fromRelativePath, toRelativePath) => {
    moveWorkspaceEntry(rootUri, fromRelativePath, toRelativePath, workspaceFile)
  },
  readVaultConfig: (rootUri) => {
    const file = vaultConfigFile(expoFileSystem(), rootUri)
    return file.exists ? parseMobileVaultConfig(file.textSync()) : null
  },
  readTextFile: (rootUri, relativePath) => {
    const normalizedPath = normalizedWorkspaceRelativePath(relativePath)
    if (!normalizedPath) return null

    const file = workspaceFile(expoFileSystem(), rootUri, normalizedPath)
    return file.exists ? file.textSync() : null
  },
  readVaultFiles: (rootUri) => {
    const module = expoFileSystem()
    const root = new module.Directory(rootUri)
    if (!root.exists) return []

    return readDirectoryFiles(module, root, '')
  },
  readVaultDirectories: (rootUri) => {
    const module = expoFileSystem()
    const root = new module.Directory(rootUri)
    if (!root.exists) return []

    return readDirectoryPaths(module, root, '')
  },
  writeTextFile: (rootUri, relativePath, content) => {
    const normalizedPath = requireWorkspaceWritePath(relativePath)

    const file = workspaceFile(expoFileSystem(), rootUri, normalizedPath)
    file.parentDirectory.create({ idempotent: true, intermediates: true })
    if (!file.exists) file.create({ intermediates: true })
    file.write(content, { encoding: 'utf8' })
  },
  writeVaultConfig: (rootUri, config) => {
    const file = vaultConfigFile(expoFileSystem(), rootUri)
    file.parentDirectory.create({ idempotent: true, intermediates: true })
    if (!file.exists) file.create({ intermediates: true })
    file.write(serializeMobileVaultConfig(config), { encoding: 'utf8' })
  },
}

function expoFileSystem(): ExpoFileSystemModule {
  expoFileSystemModule ??= require('expo-file-system')
  return expoFileSystemModule
}

function moveWorkspaceEntry(
  rootUri: RootUri,
  fromRelativePath: RelativeVaultPath,
  toRelativePath: RelativeVaultPath,
  entryForPath: (module: ExpoFileSystemModule, rootUri: RootUri, relativePath: RelativeVaultPath) => MovableWorkspaceEntry,
) {
  const fromPath = requireWorkspaceWritePath(fromRelativePath)
  const toPath = requireWorkspaceWritePath(toRelativePath)

  const module = expoFileSystem()
  const source = entryForPath(module, rootUri, fromPath)
  const destination = entryForPath(module, rootUri, toPath)
  if (!source.exists) throw new Error('workspaceMoveSourceMissing')
  if (fromPath === toPath) return
  if (destination.exists) throw new Error('workspaceMoveDestinationExists')

  destination.parentDirectory.create({ idempotent: true, intermediates: true })
  source.move(destination)
}

function readDirectoryFiles(
  module: ExpoFileSystemModule,
  directory: Directory,
  currentRelativePath: RelativeVaultPath,
): LocalVaultFile[] {
  const files: LocalVaultFile[] = []

  for (const entry of directory.list()) {
    const relativePath = joinedRelativePath(currentRelativePath, entry.name)
    if (entry instanceof module.Directory && shouldReadDirectory(entry.name)) {
      files.push(...readDirectoryFiles(module, entry, relativePath))
    } else if (entry instanceof module.File && shouldReadFile(relativePath)) {
      files.push(localVaultFile(entry, relativePath))
    }
  }

  return files
}

function readDirectoryPaths(
  module: ExpoFileSystemModule,
  directory: Directory,
  currentRelativePath: RelativeVaultPath,
): RelativeVaultPath[] {
  const directories: RelativeVaultPath[] = []

  for (const entry of directory.list()) {
    const relativePath = joinedRelativePath(currentRelativePath, entry.name)
    if (entry instanceof module.Directory && shouldReadDirectory(entry.name)) {
      directories.push(relativePath, ...readDirectoryPaths(module, entry, relativePath))
    }
  }

  return directories
}

function localVaultFile(file: File, relativePath: RelativeVaultPath): LocalVaultFile {
  const info = file.info()
  const fileKind = mobileFileKindForPath(relativePath)
  const content = fileKind === 'binary' ? '' : safeTextContent(file)

  return {
    absolutePath: file.uri,
    content,
    createdAt: info.creationTime ?? file.creationTime ?? null,
    fileKind,
    modifiedAt: info.modificationTime ?? file.modificationTime ?? null,
    relativePath,
    size: info.size ?? content.length,
  }
}

function workspaceFile(module: ExpoFileSystemModule, rootUri: RootUri, relativePath: RelativeVaultPath): File {
  return new module.File(rootUri, ...relativePath.split('/'))
}

function workspaceDirectory(module: ExpoFileSystemModule, rootUri: RootUri, relativePath: RelativeVaultPath): Directory {
  return new module.Directory(rootUri, ...relativePath.split('/'))
}

function vaultConfigFile(module: ExpoFileSystemModule, rootUri: RootUri): File {
  const directory = new module.Directory(module.Paths.document, '.tolaria-mobile-config')
  return new module.File(directory.uri, `${stableVaultConfigName(rootUri)}.json`)
}

function stableVaultConfigName(rootUri: RootUri): string {
  let hash = 2_166_136_261
  for (let index = 0; index < rootUri.length; index += 1) {
    hash ^= rootUri.charCodeAt(index)
    hash = Math.imul(hash, 16_777_619)
  }

  return `vault-${(hash >>> 0).toString(36)}`
}

function joinedRelativePath(parent: RelativeVaultPath, name: DirectoryName): RelativeVaultPath {
  return parent ? `${parent}/${name}` : name
}

function shouldReadFile(relativePath: RelativeVaultPath): boolean {
  return Boolean(relativePath.split('/').at(-1))
}

function shouldReadDirectory(name: DirectoryName): boolean {
  return !name.startsWith('.') && name !== 'node_modules'
}

function safeTextContent(file: File): string {
  try {
    return file.textSync()
  } catch {
    return ''
  }
}
