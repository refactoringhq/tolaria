import { Buffer } from 'buffer'
import type * as ExpoFileSystem from 'expo-file-system'
import { gitFileUri, gitFsError } from './gitFileSystemPaths'

type FileSystemModule = typeof ExpoFileSystem
type GitPath = string
type FileUri = string
declare const require: (name: string) => FileSystemModule

export function createExpoGitFileSystem(rootUri: FileUri, module: FileSystemModule = require('expo-file-system')) {
  const uri = (path: GitPath) => gitFileUri(rootUri, path)
  const file = (path: GitPath) => new module.File(uri(path))
  const directory = (path: GitPath) => new module.Directory(uri(path))
  const stat = async (path: GitPath) => gitStat(module, uri(path))
  return {
    promises: {
      readFile: async (path: GitPath, options?: string | { encoding?: string }) => {
        requireEntry(module, uri(path), false)
        const bytes = Buffer.from(await file(path).bytes())
        return options === 'utf8' || (typeof options === 'object' && options.encoding === 'utf8')
          ? bytes.toString('utf8') : bytes
      },
      writeFile: async (path: GitPath, content: string | Uint8Array) => {
        requireParent(module, uri(path))
        // Expo's JSI converter requires a plain Uint8Array, not a Buffer subclass.
        file(path).write(typeof content === 'string' ? content : new Uint8Array(content))
      },
      unlink: async (path: GitPath) => { requireEntry(module, uri(path), false); file(path).delete() },
      readdir: async (path: GitPath) => {
        requireEntry(module, uri(path), true)
        return directory(path).list().map((entry) => entry.name)
      },
      mkdir: async (path: GitPath) => {
        if (module.Paths.info(uri(path)).exists) throw gitFsError('EEXIST')
        requireParent(module, uri(path))
        directory(path).create()
      },
      rmdir: async (path: GitPath) => {
        requireEntry(module, uri(path), true)
        if (directory(path).list().length) throw gitFsError('ENOTEMPTY')
        directory(path).delete()
      },
      stat,
      lstat: stat,
      readlink: async () => { throw gitFsError('ENOTSUP') },
      symlink: async () => { throw gitFsError('ENOTSUP') },
    },
  }
}

function requireParent(module: FileSystemModule, uri: FileUri) {
  const parent = uri.slice(0, uri.replace(/\/$/u, '').lastIndexOf('/'))
  requireEntry(module, parent, true)
}

function requireEntry(module: FileSystemModule, uri: FileUri, directory: boolean) {
  const info = module.Paths.info(uri)
  if (!info.exists) throw gitFsError('ENOENT')
  if (info.isDirectory !== directory) throw gitFsError(directory ? 'ENOTDIR' : 'EISDIR')
}

function gitStat(module: FileSystemModule, uri: FileUri) {
  const info = module.Paths.info(uri)
  if (!info.exists) throw gitFsError('ENOENT')
  const isDirectory = Boolean(info.isDirectory)
  const metadata = isDirectory ? null : new module.File(uri).info()
  return {
    isDirectory: () => isDirectory,
    isFile: () => !isDirectory,
    isSymbolicLink: () => false,
    size: metadata?.size ?? 0,
    mode: isDirectory ? 0o40755 : 0o100644,
    mtimeMs: metadata?.modificationTime ?? 0,
    ctimeMs: metadata?.creationTime ?? 0,
    uid: 0,
    gid: 0,
    dev: 0,
    ino: 0,
  }
}
