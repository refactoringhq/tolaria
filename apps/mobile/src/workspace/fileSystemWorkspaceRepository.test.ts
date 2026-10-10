import { describe, expect, it } from 'vitest'
import { createFileSystemWorkspaceRepository, normalizedWorkspaceRelativePath, type WorkspaceFileSystem } from './fileSystemWorkspaceRepository'
import { mobileFileKindForPath, type LocalVaultFile } from './localVaultSnapshot'
import type { MobileVaultConfig } from './mobileWorkspaceModel'

type RelativePath = string
type MovePathInput = {
  fromRelativePath: RelativePath
  path: RelativePath
  toRelativePath: RelativePath
}

describe('createFileSystemWorkspaceRepository', () => {
  it('requires an explicitly selected native vault root', async () => {
    const fileSystem = fakeWorkspaceFileSystem({
      'Hidden QA Note.md': '# Hidden QA Note\n',
    })
    const repository = createFileSystemWorkspaceRepository(fileSystem)

    const snapshot = repository.readSnapshot({ source: 'native' })
    await expect(repository.persistWrites([{
      content: '# Phantom Note\n',
      kind: 'createNote',
      path: 'Phantom Note.md',
    }], { source: 'native' })).rejects.toThrow('workspaceNotSelected')

    expect(snapshot).toMatchObject({
      notes: [],
      source: { totalNotes: 0, vaultPath: '' },
      sync: { kind: 'noVault' },
    })
    expect(fileSystem.files()).toEqual({
      'Hidden QA Note.md': '# Hidden QA Note\n',
    })
  })

  it('builds snapshots from markdown and saved-view files in the selected native vault root', () => {
    const fileSystem = fakeWorkspaceFileSystem({
      'views/active-essays.yml': 'name: Active Essays\nfilters:\n  type: Essay\n',
      'Writing/Workflow.md': `---
type: Essay
status: Active
belongs_to:
  - "[[Projects/Tolaria MVP]]"
tags:
  - Design
---
# Workflow

Body with [[Projects/Tolaria MVP]].
`,
      'Projects/Tolaria MVP.md': `---
type: Project
---
# Tolaria MVP
`,
    })
    const repository = createFileSystemWorkspaceRepository(fileSystem)

    const snapshot = repository.readSnapshot({
      source: 'native',
      vaultAlias: 'laputa',
      vaultLabel: 'Laputa',
      vaultRootUri: 'file:///vault',
    })
    const workflow = snapshot.allNotes?.find((note) => note.path === 'Writing/Workflow.md')

    expect(snapshot.folderPaths).toEqual(expect.arrayContaining(['Projects', 'Writing']))
    expect(snapshot.source).toMatchObject({ alias: 'laputa', kind: 'localVault', label: 'Laputa', totalNotes: 3 })
    expect(workflow).toMatchObject({
      path: 'Writing/Workflow.md',
      relationships: [expect.objectContaining({ key: 'belongs_to' })],
      title: 'Workflow',
      workspaceAlias: 'laputa',
    })
    expect(snapshot.notes.find((note) => note.path === 'Writing/Workflow.md')?.rawContent).toContain('# Workflow')
    expect(snapshot.sidebarSections.find((section) => section.id === 'views')?.items?.[0]).toMatchObject({
      icon: 'view',
      label: 'Active Essays',
    })
    expect(snapshot.allNotes?.find((note) => note.path === 'views/active-essays.yml')).toMatchObject({
      fileKind: 'text',
      title: 'Active Essays',
      type: 'File',
    })
  })

  it('persists vault-scoped note-list config outside the vault file list', async () => {
    const fileSystem = fakeWorkspaceFileSystem({
      'Writing/Workflow.md': '# Workflow\n\n',
    })
    const repository = createFileSystemWorkspaceRepository(fileSystem)
    const request = { source: 'native' as const, vaultLabel: 'Laputa', vaultRootUri: 'file:///vault' }

    await repository.persistWrites([{
      config: {
        allNotes: {
          fileVisibility: { images: true, pdfs: true, unsupported: false },
          noteListProperties: ['status', 'belongs_to'],
        },
        defaultNoteWidth: 'wide',
        inbox: { explicitOrganization: true, noteListProperties: ['tags'] },
      },
      kind: 'saveVaultConfig',
    }], request)

    expect(fileSystem.files()).toEqual({
      'Writing/Workflow.md': '# Workflow\n\n',
    })
    expect(fileSystem.vaultConfigs()).toEqual({
      'file:///vault': {
        allNotes: {
          fileVisibility: { images: true, pdfs: true, unsupported: false },
          noteListProperties: ['status', 'belongs_to'],
        },
        defaultNoteWidth: 'wide',
        inbox: { explicitOrganization: true, noteListProperties: ['tags'] },
      },
    })
    expect(repository.readSnapshot(request)).toMatchObject({
      noteListPropertyOverrides: {
        allNotes: ['status', 'belongs_to'],
        inbox: ['tags'],
      },
      vaultConfig: {
        allNotes: {
          fileVisibility: { images: true, pdfs: true, unsupported: false },
          noteListProperties: ['status', 'belongs_to'],
        },
        defaultNoteWidth: 'wide',
        inbox: { explicitOrganization: true, noteListProperties: ['tags'] },
      },
    })
  })

  it('keeps binary vault files as metadata-only entries for folder navigation', () => {
    const fileSystem = fakeWorkspaceFileSystem({
      'Assets/logo.png': '',
      'Writing/Workflow.md': '# Workflow\n\n',
    })
    const repository = createFileSystemWorkspaceRepository(fileSystem)

    const snapshot = repository.readSnapshot({ source: 'native', vaultLabel: 'Laputa', vaultRootUri: 'file:///vault' })

    expect(snapshot.sidebarSections.find((section) => section.id === 'primary')?.items).toEqual([
      expect.objectContaining({ count: '1', id: 'inbox' }),
      expect.objectContaining({ count: '1', id: 'all-notes' }),
      expect.objectContaining({ count: '0', id: 'archive' }),
    ])
    expect(snapshot.allNotes?.find((note) => note.path === 'Assets/logo.png')).toMatchObject({
      fileKind: 'binary',
      rawContent: undefined,
      title: 'logo.png',
      type: 'File',
    })
  })

  it('counts optional file entries in All Notes when vault config enables desktop visibility', async () => {
    const fileSystem = fakeWorkspaceFileSystem({
      'Assets/logo.png': '',
      'Docs/brief.pdf': '',
      'Docs/config.yml': 'name: Tolaria\n',
      'Writing/Workflow.md': '# Workflow\n\n',
    })
    const repository = createFileSystemWorkspaceRepository(fileSystem)
    const request = { source: 'native' as const, vaultLabel: 'Laputa', vaultRootUri: 'file:///vault' }

    await repository.persistWrites([{
      config: {
        allNotes: {
          fileVisibility: { images: true, pdfs: true, unsupported: false },
        },
      },
      kind: 'saveVaultConfig',
    }], request)

    const snapshot = repository.readSnapshot(request)

    expect(snapshot.sidebarSections.find((section) => section.id === 'primary')?.items).toEqual([
      expect.objectContaining({ count: '1', id: 'inbox' }),
      expect.objectContaining({ count: '3', id: 'all-notes' }),
      expect.objectContaining({ count: '0', id: 'archive' }),
    ])
  })

  it('hydrates and persists note content through relative vault paths', async () => {
    const fileSystem = fakeWorkspaceFileSystem({
      'Writing/Workflow.md': '# Workflow\n\nOriginal body.\n',
    })
    const repository = createFileSystemWorkspaceRepository(fileSystem)

    await expect(repository.readNoteContent({
      created: '-',
      date: '-',
      favorite: false,
      id: 'Writing/Workflow.md',
      links: 0,
      modified: '-',
      path: 'Writing/Workflow.md',
      relationships: [],
      snippet: '',
      status: '',
      tags: [],
      title: 'Workflow',
      type: 'Note',
      typeTone: 'gray',
      workspace: 'Laputa',
    }, { source: 'native', vaultRootUri: 'file:///vault' })).resolves.toBe('# Workflow\n\nOriginal body.\n')

    await repository.persistWrites([{
      content: '# Workflow\n\nUpdated body.\n',
      kind: 'saveNote',
      path: 'Writing/Workflow.md',
    }, {
      content: '# New Note\n\n',
      kind: 'createNote',
      path: 'New Note.md',
    }, {
      content: 'name: Mobile View\nfilters:\n  all: []\n',
      kind: 'saveView',
      path: 'views/mobile-view.yml',
    }], { source: 'native', vaultRootUri: 'file:///vault' })

    expect(fileSystem.files()).toMatchObject({
      'New Note.md': '# New Note\n\n',
      'Writing/Workflow.md': '# Workflow\n\nUpdated body.\n',
      'views/mobile-view.yml': 'name: Mobile View\nfilters:\n  all: []\n',
    })
  })

  it('moves note files through relative vault paths without rewriting content', async () => {
    const fileSystem = fakeWorkspaceFileSystem({
      'Writing/Workflow.md': '# Workflow\n\nOriginal body.\n',
    })
    const repository = createFileSystemWorkspaceRepository(fileSystem)

    await repository.persistWrites([{
      kind: 'moveNote',
      path: 'Writing/Workflow.md',
      toPath: 'Research/Workflow.md',
    }], { source: 'native', vaultRootUri: 'file:///vault' })

    expect(fileSystem.files()).toEqual({
      'Research/Workflow.md': '# Workflow\n\nOriginal body.\n',
    })
    expect(fileSystem.directories()).toEqual(['Research', 'Writing'])
  })

  it('does not overwrite an existing file when moving a note', async () => {
    const fileSystem = fakeWorkspaceFileSystem({
      'Research/Workflow.md': '# Existing\n\n',
      'Writing/Workflow.md': '# Workflow\n\nOriginal body.\n',
    })
    const repository = createFileSystemWorkspaceRepository(fileSystem)

    await repository.persistWrites([{
      kind: 'moveNote',
      path: 'Writing/Workflow.md',
      toPath: 'Research/Workflow.md',
    }], { source: 'native', vaultRootUri: 'file:///vault' })

    expect(fileSystem.files()).toEqual({
      'Research/Workflow.md': '# Existing\n\n',
      'Writing/Workflow.md': '# Workflow\n\nOriginal body.\n',
    })
  })

  it('deletes note and saved-view files through relative vault paths', async () => {
    const fileSystem = fakeWorkspaceFileSystem({
      'Writing/Workflow.md': '# Workflow\n\n',
      'views/mobile-view.yml': 'name: Mobile View\nfilters:\n  all: []\n',
    })
    const repository = createFileSystemWorkspaceRepository(fileSystem)

    await repository.persistWrites([{
      kind: 'deleteNote',
      path: 'Writing/Workflow.md',
    }, {
      kind: 'deleteView',
      path: 'views/mobile-view.yml',
    }], { source: 'native', vaultRootUri: 'file:///vault' })

    expect(fileSystem.files()).toEqual({})
  })

  it('persists folder create, rename, and delete writes through relative vault paths', async () => {
    const fileSystem = fakeWorkspaceFileSystem({
      'Writing/Workflow.md': '# Workflow\n\n',
    })
    const repository = createFileSystemWorkspaceRepository(fileSystem)

    await repository.persistWrites([{
      kind: 'createFolder',
      path: 'Writing/Drafts',
    }, {
      kind: 'renameFolder',
      path: 'Writing',
      toPath: 'Research',
    }, {
      kind: 'deleteFolder',
      path: 'Research/Drafts',
    }], { source: 'native', vaultRootUri: 'file:///vault' })

    expect(fileSystem.files()).toEqual({
      'Research/Workflow.md': '# Workflow\n\n',
    })
    expect(fileSystem.directories()).toEqual(['Research'])
  })

  it('rejects absolute and parent-traversal write paths', async () => {
    const fileSystem = fakeWorkspaceFileSystem({})
    const repository = createFileSystemWorkspaceRepository(fileSystem)

    await expect(repository.persistWrites([{
      content: 'nope',
      kind: 'saveNote',
      path: '../outside.md',
    }, {
      content: 'nope',
      kind: 'saveNote',
      path: 'file:///outside.md',
    }], { source: 'native', vaultRootUri: 'file:///vault' })).rejects.toThrow('invalidWorkspacePath')

    expect(fileSystem.files()).toEqual({})
    expect(normalizedWorkspaceRelativePath('Folder\\Note.md')).toBe('Folder/Note.md')
    expect(normalizedWorkspaceRelativePath('/absolute.md')).toBeNull()
  })
})

function fakeWorkspaceFileSystem(initialFiles: Record<string, string>): WorkspaceFileSystem & {
  directories: () => string[]
  files: () => Record<string, string>
  vaultConfigs: () => Record<string, MobileVaultConfig>
} {
  const files = new Map(Object.entries(initialFiles))
  const directories = new Set<string>(folderPathsForFiles(Object.keys(initialFiles)))
  const vaultConfigs = new Map<string, MobileVaultConfig>()

  return {
    createDirectory: (_rootUri, relativePath) => {
      directories.add(relativePath)
    },
    deleteDirectory: (_rootUri, relativePath) => {
      for (const path of [...directories]) {
        if (path === relativePath || path.startsWith(`${relativePath}/`)) directories.delete(path)
      }
      for (const path of [...files.keys()]) {
        if (path.startsWith(`${relativePath}/`)) files.delete(path)
      }
    },
    deleteTextFile: (_rootUri, relativePath) => {
      files.delete(relativePath)
    },
    directories: () => [...directories].sort(),
    files: () => Object.fromEntries(files),
    moveDirectory: (_rootUri, fromRelativePath, toRelativePath) => {
      for (const path of [...directories]) {
        const movedPath = movedDirectoryPath({ fromRelativePath, path, toRelativePath })
        if (!movedPath) continue

        directories.delete(path)
        directories.add(movedPath)
      }
      for (const [path, content] of [...files.entries()]) {
        const movedPath = movedFilePath({ fromRelativePath, path, toRelativePath })
        if (!movedPath) continue

        files.delete(path)
        files.set(movedPath, content)
      }
    },
    moveTextFile: (_rootUri, fromRelativePath, toRelativePath) => {
      const content = files.get(fromRelativePath)
      if (content === undefined || files.has(toRelativePath)) return

      files.delete(fromRelativePath)
      for (const path of folderPathsForFiles([toRelativePath])) directories.add(path)
      files.set(toRelativePath, content)
    },
    readVaultConfig: (rootUri) => vaultConfigs.get(rootUri) ?? null,
    readTextFile: (_rootUri, relativePath) => files.get(relativePath) ?? null,
    readVaultDirectories: () => [...directories],
    readVaultFiles: (rootUri) => [...files.entries()].map(([relativePath, content], index) => localVaultFile(rootUri, relativePath, content, index)),
    vaultConfigs: () => Object.fromEntries(vaultConfigs),
    writeVaultConfig: (rootUri, config) => {
      vaultConfigs.set(rootUri, config)
    },
    writeTextFile: (_rootUri, relativePath, content) => {
      for (const path of folderPathsForFiles([relativePath])) directories.add(path)
      files.set(relativePath, content)
    },
  }
}

function movedDirectoryPath({ fromRelativePath, path, toRelativePath }: MovePathInput): RelativePath | null {
  if (path !== fromRelativePath && !path.startsWith(`${fromRelativePath}/`)) return null
  return `${toRelativePath}${path.slice(fromRelativePath.length)}`
}

function movedFilePath({ fromRelativePath, path, toRelativePath }: MovePathInput): RelativePath | null {
  if (!path.startsWith(`${fromRelativePath}/`)) return null
  return `${toRelativePath}${path.slice(fromRelativePath.length)}`
}

function folderPathsForFiles(paths: string[]): string[] {
  const folders = new Set<string>()
  for (const path of paths) {
    const parts = path.split('/').slice(0, -1)
    for (let index = 1; index <= parts.length; index += 1) folders.add(parts.slice(0, index).join('/'))
  }
  return [...folders].filter(Boolean)
}

function localVaultFile(rootUri: string, relativePath: string, content: string, index: number): LocalVaultFile {
  const fileKind = mobileFileKindForPath(relativePath)
  return {
    absolutePath: `${rootUri}/${relativePath}`,
    content: fileKind === 'binary' ? '' : content,
    createdAt: 1_700_000_000_000 + index,
    fileKind,
    modifiedAt: 1_700_000_000_000 + index,
    relativePath,
    size: content.length,
  }
}
