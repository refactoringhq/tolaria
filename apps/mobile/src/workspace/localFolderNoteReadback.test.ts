import { expect, it } from 'vitest'
import { createFileSystemWorkspaceRepository, type WorkspaceFileSystem } from './fileSystemWorkspaceRepository'
import { mobileNoteListMatchesQuery } from './mobileNoteSearch'
import { applyMobileWorkspaceEditWithWrites } from './mobileWorkspaceEditing'
import type { MobileNote, MobileWorkspaceSnapshot } from './mobileWorkspaceModel'

const request = {
  source: 'native' as const,
  vaultAlias: 'synthetic-713',
  vaultLabel: 'Tolaria-QA-SYNTHETIC-713',
  vaultRootUri: 'file:///synthetic/Tolaria-QA-SYNTHETIC-713',
}

function emptyLocalFolder(): WorkspaceFileSystem & { files: Map<string, string> } {
  const files = new Map<string, string>()
  const unsupported = () => { throw new Error('unexpectedWorkspaceMutation') }
  return {
    files,
    createDirectory: unsupported,
    deleteDirectory: unsupported,
    deleteTextFile: (_root, path) => { files.delete(path) },
    moveDirectory: unsupported,
    moveTextFile: (_root, from, to) => {
      files.set(to, files.get(from) ?? '')
      files.delete(from)
    },
    readVaultDirectories: () => [],
    readTextFile: (_root, path) => files.get(path) ?? null,
    readVaultFiles: (root) => [...files].map(([relativePath, content]) => ({
      absolutePath: `${root}/${relativePath}`,
      content,
      createdAt: 1,
      modifiedAt: 1,
      relativePath,
      size: content.length,
    })),
    writeTextFile: (_root, path, content) => { files.set(path, content) },
  }
}

function created(before: MobileWorkspaceSnapshot, after: MobileWorkspaceSnapshot): MobileNote {
  const known = new Set((before.allNotes ?? before.notes).map((note) => note.id))
  const note = (after.allNotes ?? after.notes).find((candidate) => !known.has(candidate.id))
  if (!note) throw new Error('createdNoteMissing')
  return note
}

it('persists, lists, reopens and searches new notes in an empty local folder twice without a GitHub session', async () => {
  const folder = emptyLocalFolder()
  const repository = createFileSystemWorkspaceRepository(folder)
  let snapshot = repository.readSnapshot(request)
  expect(snapshot.allNotes ?? snapshot.notes).toHaveLength(0)

  for (const marker of ['orchid713a', 'orchid713b']) {
    const creation = applyMobileWorkspaceEditWithWrites(snapshot, { type: 'createNote', title: `QA Navigation Probe ${marker}` })
    await repository.persistWrites(creation.writes, request)
    const note = created(snapshot, creation.snapshot)

    const body = `${note.rawContent ?? ''}\nSynthetic QA-713-20261107 ${marker}\n`
    const edit = applyMobileWorkspaceEditWithWrites(creation.snapshot, { type: 'updateNoteContent', noteId: note.id, content: body })
    await repository.persistWrites(edit.writes, request)

    snapshot = repository.readSnapshot(request)
    const listed = (snapshot.allNotes ?? snapshot.notes).find((candidate) => candidate.path === note.path)
    if (!listed?.path) throw new Error('createdNoteNotListed')
    expect(await repository.readNoteContent(listed, request)).toBe(body)
    expect(folder.files.get(listed.path)).toBe(body)
    expect((snapshot.allNotes ?? snapshot.notes).filter((candidate) => mobileNoteListMatchesQuery(candidate, marker)))
      .toEqual([expect.objectContaining({ path: note.path })])
  }

  expect(folder.files.size).toBe(2)
})
