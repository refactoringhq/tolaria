import { expect, it, vi } from 'vitest'
import { createFileSystemWorkspaceRepository, type WorkspaceFileSystem } from './fileSystemWorkspaceRepository'
import { withSavedWorkspace } from './git/workspaceWriteQueue'

function fileSystem(): WorkspaceFileSystem {
  return {
    createDirectory: vi.fn(), deleteDirectory: vi.fn(), deleteTextFile: vi.fn(),
    moveDirectory: vi.fn(), moveTextFile: vi.fn(), writeTextFile: vi.fn(),
    readVaultDirectories: () => [], readVaultFiles: () => [], readTextFile: () => null,
  }
}

it('rejects writes without a granted root instead of reporting success', async () => {
  const fs = fileSystem()
  const repository = createFileSystemWorkspaceRepository(fs)
  await expect(repository.persistWrites([{ kind: 'saveNote', path: 'note.md', content: 'draft' }])).rejects.toThrow()
  expect(fs.writeTextFile).not.toHaveBeenCalled()
})

it('validates the whole write plan before queuing any mutations', async () => {
  const fs = fileSystem()
  const repository = createFileSystemWorkspaceRepository(fs)
  const request = { source: 'native' as const, vaultRootUri: 'file:///validation-test' }
  await expect(repository.persistWrites([
    { kind: 'saveNote', path: 'valid.md', content: 'draft' },
    { kind: 'moveNote', path: 'valid.md', toPath: '../outside.md' },
  ], request)).rejects.toThrow()
  expect(fs.writeTextFile).not.toHaveBeenCalled()
  await repository.persistWrites([{ kind: 'saveNote', path: 'valid.md', content: 'retry' }], request)
  expect(fs.writeTextFile).toHaveBeenCalledWith(request.vaultRootUri, 'valid.md', 'retry')
})

it('awaits asynchronous native writes before allowing sync to read the working copy', async () => {
  const fs = fileSystem()
  let release!: () => void
  fs.writeTextFile = () => new Promise<void>((resolve) => { release = resolve })
  const repository = createFileSystemWorkspaceRepository(fs)
  const root = 'file:///async-validation-test'
  const saved = repository.persistWrites([{ kind: 'saveNote', path: 'note.md', content: 'draft' }], { vaultRootUri: root })
  const sync = vi.fn()
  const syncing = withSavedWorkspace(root, async () => { sync() })
  await vi.waitFor(() => expect(release).toBeTypeOf('function'))
  await new Promise((resolve) => setTimeout(resolve, 10))
  expect(sync).not.toHaveBeenCalled()
  release()
  await saved
  await syncing
  expect(sync).toHaveBeenCalledOnce()
})
