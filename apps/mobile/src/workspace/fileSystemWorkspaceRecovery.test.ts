import { expect, it, vi } from 'vitest'
import { createFileSystemWorkspaceRepository, type WorkspaceFileSystem } from './fileSystemWorkspaceRepository'

function file(content: string) {
  return {
    absolutePath: 'file:///recovery-fixture/note.md', relativePath: 'note.md', content,
    createdAt: 0, modifiedAt: 0, size: content.length,
  }
}

function recoveryFileSystem() {
  return {
    createDirectory: vi.fn(), deleteDirectory: vi.fn(), deleteTextFile: vi.fn(),
    moveDirectory: vi.fn(), moveTextFile: vi.fn(), writeTextFile: vi.fn(),
    readTextFile: vi.fn(() => '# Recovered'), readVaultDirectories: vi.fn(() => []),
    readVaultFiles: vi.fn(() => [file('# Recovered')]),
    recoverPendingWrites: vi.fn(() => true),
  } satisfies WorkspaceFileSystem
}

const request = {
  source: 'native' as const, vaultRootUri: 'file:///recovery-fixture',
  workspaceIndex: { directories: [], files: [file('# Stale')] },
}

it('discards a launch index built before a recovered save', () => {
  const files = recoveryFileSystem()
  const snapshot = createFileSystemWorkspaceRepository(files).readSnapshot(request)
  expect(files.recoverPendingWrites).toHaveBeenCalledWith(request.vaultRootUri)
  expect(snapshot.notes[0].title).toBe('Recovered')
  expect(files.readVaultFiles).toHaveBeenCalledOnce()
})

it('keeps the fast native launch index when no replay was needed', () => {
  const files = recoveryFileSystem()
  files.recoverPendingWrites.mockReturnValue(false)
  const snapshot = createFileSystemWorkspaceRepository(files).readSnapshot(request)
  expect(snapshot.notes[0].title).toBe('Stale')
  expect(files.readVaultFiles).not.toHaveBeenCalled()
})

it('does not expose a cached editable snapshot when recovery fails', () => {
  const files = recoveryFileSystem()
  files.recoverPendingWrites.mockImplementation(() => { throw new Error('externalChange') })
  expect(() => createFileSystemWorkspaceRepository(files).readSnapshot(request)).toThrow('externalChange')
  expect(files.readVaultFiles).not.toHaveBeenCalled()
})

it('does not hydrate an editor from raw content cached before recovery', async () => {
  const files = recoveryFileSystem()
  files.recoverPendingWrites.mockReturnValue(false)
  const repository = createFileSystemWorkspaceRepository(files)
  const note = repository.readSnapshot(request).notes[0]
  files.recoverPendingWrites.mockReturnValue(true)
  await expect(repository.readNoteContent(note, request)).resolves.toBe('# Recovered')
  expect(files.readTextFile).toHaveBeenCalledWith(request.vaultRootUri, 'note.md')
})
