import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { VaultEntry, ModifiedFile, GitCommit } from '../types'
import { useVaultLoader, resolveNoteStatus } from './useVaultLoader'

const mockEntries: VaultEntry[] = [
  {
    path: '/vault/note/hello.md', filename: 'hello.md', title: 'Hello',
    isA: 'Note', aliases: [], belongsTo: [], relatedTo: [],
    status: 'Active', owner: null, cadence: null,
    archived: false, trashed: false, trashedAt: null,
    modifiedAt: 1700000000, createdAt: 1700000000, fileSize: 100,
    snippet: '', wordCount: 0, relationships: {}, icon: null, color: null, order: null, template: null, outgoingLinks: [],
  },
]

const mockContent: Record<string, string> = {
  '/vault/note/hello.md': '---\ntitle: Hello\n---\n\n# Hello\n',
}

const mockModifiedFiles: ModifiedFile[] = [
  { path: '/vault/note/hello.md', relativePath: 'note/hello.md', status: 'modified' },
]

const mockGitHistory: GitCommit[] = [
  { hash: 'abc1234567', shortHash: 'abc1234', message: 'initial commit', author: 'luca', date: 1700000000 },
]

function defaultMockInvoke(cmd: string, args?: Record<string, unknown>) {
  if (cmd === 'list_vault') return Promise.resolve(mockEntries)
  if (cmd === 'get_all_content') return Promise.resolve(mockContent)
  if (cmd === 'get_modified_files') return Promise.resolve(mockModifiedFiles)
  if (cmd === 'get_file_history') return Promise.resolve(mockGitHistory)
  if (cmd === 'get_file_diff') return Promise.resolve('--- a/note.md\n+++ b/note.md')
  if (cmd === 'get_file_diff_at_commit') return Promise.resolve(`diff for ${(args as Record<string, string>)?.commitHash}`)
  if (cmd === 'git_commit') return Promise.resolve('committed')
  if (cmd === 'git_push') return Promise.resolve('pushed')
  return Promise.resolve(null)
}

const mockInvokeFn = vi.fn(defaultMockInvoke)

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: (cmd: string, args?: Record<string, unknown>) => mockInvokeFn(cmd, args),
}))

/** Render the vault loader hook and wait for initial data to load. */
async function renderVaultLoader() {
  const hook = renderHook(() => useVaultLoader('/vault'))
  await waitFor(() => { expect(hook.result.current.entries).toHaveLength(1) })
  return hook
}

describe('useVaultLoader', () => {
  beforeEach(() => {
    mockInvokeFn.mockImplementation(defaultMockInvoke)
  })

  it('loads entries and content on mount', async () => {
    const { result } = await renderVaultLoader()

    expect(result.current.entries[0].title).toBe('Hello')
    expect(result.current.allContent['/vault/note/hello.md']).toContain('# Hello')
  })

  it('loads modified files on mount', async () => {
    const { result } = renderHook(() => useVaultLoader('/vault'))

    await waitFor(() => {
      expect(result.current.modifiedFiles).toHaveLength(1)
    })

    expect(result.current.modifiedFiles[0].status).toBe('modified')
  })

  describe('addEntry', () => {
    it('prepends new entry and adds content', async () => {
      const { result } = await renderVaultLoader()
      const newEntry: VaultEntry = { ...mockEntries[0], path: '/vault/note/new.md', filename: 'new.md', title: 'New Note' }

      act(() => { result.current.addEntry(newEntry, '# New Note') })

      expect(result.current.entries).toHaveLength(2)
      expect(result.current.entries[0].title).toBe('New Note')
      expect(result.current.allContent['/vault/note/new.md']).toBe('# New Note')
    })

    it('ignores duplicate entry with same path', async () => {
      const { result } = await renderVaultLoader()
      const newEntry: VaultEntry = { ...mockEntries[0], path: '/vault/note/new.md', filename: 'new.md', title: 'New Note' }

      act(() => {
        result.current.addEntry(newEntry, '# New Note')
        result.current.addEntry(newEntry, '# New Note')
      })

      expect(result.current.entries).toHaveLength(2)
    })
  })

  describe('updateContent', () => {
    it('updates content for an existing path', async () => {
      const { result } = await renderVaultLoader()

      act(() => { result.current.updateContent('/vault/note/hello.md', '# Updated') })

      expect(result.current.allContent['/vault/note/hello.md']).toBe('# Updated')
    })
  })

  describe('removeEntry', () => {
    it('removes entry and content by path', async () => {
      const { result } = await renderVaultLoader()

      act(() => { result.current.removeEntry('/vault/note/hello.md') })

      expect(result.current.entries).toHaveLength(0)
      expect(result.current.allContent['/vault/note/hello.md']).toBeUndefined()
    })

    it('is a no-op for non-existent paths', async () => {
      const { result } = await renderVaultLoader()

      act(() => { result.current.removeEntry('/vault/note/nonexistent.md') })

      expect(result.current.entries).toHaveLength(1)
    })
  })

  describe('updateEntry', () => {
    it('patches an existing entry by path', async () => {
      const { result } = await renderVaultLoader()

      act(() => { result.current.updateEntry('/vault/note/hello.md', { archived: true, status: 'Done' }) })

      expect(result.current.entries[0].archived).toBe(true)
      expect(result.current.entries[0].status).toBe('Done')
    })
  })

  describe('getNoteStatus', () => {
    it('returns modified for git-modified files', async () => {
      const { result } = renderHook(() => useVaultLoader('/vault'))

      await waitFor(() => {
        expect(result.current.modifiedFiles).toHaveLength(1)
      })

      expect(result.current.getNoteStatus('/vault/note/hello.md')).toBe('modified')
      expect(result.current.getNoteStatus('/vault/note/other.md')).toBe('clean')
    })

    it('returns new for freshly added entries', async () => {
      const { result } = await renderVaultLoader()
      const newEntry: VaultEntry = { ...mockEntries[0], path: '/vault/note/brand-new.md', filename: 'brand-new.md', title: 'Brand New' }

      act(() => { result.current.addEntry(newEntry, '# Brand New') })

      expect(result.current.getNoteStatus('/vault/note/brand-new.md')).toBe('new')
    })

    it('returns new for git-untracked files (saved but not committed)', async () => {
      mockInvokeFn.mockImplementation(((cmd: string) => {
        if (cmd === 'list_vault') return Promise.resolve(mockEntries)
        if (cmd === 'get_all_content') return Promise.resolve(mockContent)
        if (cmd === 'get_modified_files') return Promise.resolve([
          { path: '/vault/note/brand-new.md', relativePath: 'note/brand-new.md', status: 'untracked' },
        ])
        return Promise.resolve(null)
      }) as typeof defaultMockInvoke)

      const { result } = renderHook(() => useVaultLoader('/vault'))

      await waitFor(() => {
        expect(result.current.modifiedFiles).toHaveLength(1)
      })

      expect(result.current.getNoteStatus('/vault/note/brand-new.md')).toBe('new')
    })

    it('returns new for git-added files (staged but not committed)', async () => {
      mockInvokeFn.mockImplementation(((cmd: string) => {
        if (cmd === 'list_vault') return Promise.resolve(mockEntries)
        if (cmd === 'get_all_content') return Promise.resolve(mockContent)
        if (cmd === 'get_modified_files') return Promise.resolve([
          { path: '/vault/note/staged.md', relativePath: 'note/staged.md', status: 'added' },
        ])
        return Promise.resolve(null)
      }) as typeof defaultMockInvoke)

      const { result } = renderHook(() => useVaultLoader('/vault'))

      await waitFor(() => {
        expect(result.current.modifiedFiles).toHaveLength(1)
      })

      expect(result.current.getNoteStatus('/vault/note/staged.md')).toBe('new')
    })

    it('new status takes priority over git modified', async () => {
      // If a path is both new and in modifiedFiles, it should show as new
      mockInvokeFn.mockImplementation(((cmd: string) => {
        if (cmd === 'list_vault') return Promise.resolve(mockEntries)
        if (cmd === 'get_all_content') return Promise.resolve(mockContent)
        if (cmd === 'get_modified_files') return Promise.resolve([
          { path: '/vault/note/new.md', relativePath: 'note/new.md', status: 'modified' },
        ])
        return Promise.resolve(null)
      }) as typeof defaultMockInvoke)

      const { result } = renderHook(() => useVaultLoader('/vault'))

      await waitFor(() => {
        expect(result.current.modifiedFiles).toHaveLength(1)
      })

      const newEntry: VaultEntry = {
        ...mockEntries[0],
        path: '/vault/note/new.md',
        filename: 'new.md',
        title: 'New',
      }

      act(() => {
        result.current.addEntry(newEntry, '# New')
      })

      expect(result.current.getNoteStatus('/vault/note/new.md')).toBe('new')
    })

    it('returns unsaved for paths in unsavedPaths', async () => {
      const { result } = await renderVaultLoader()
      const newEntry: VaultEntry = { ...mockEntries[0], path: '/vault/note/draft.md', filename: 'draft.md', title: 'Draft' }

      act(() => {
        result.current.addEntry(newEntry, '# Draft')
        result.current.trackUnsaved('/vault/note/draft.md')
      })

      expect(result.current.getNoteStatus('/vault/note/draft.md')).toBe('unsaved')
    })

    it('unsaved has higher priority than new', async () => {
      const { result } = await renderVaultLoader()
      const newEntry: VaultEntry = { ...mockEntries[0], path: '/vault/note/draft.md', filename: 'draft.md', title: 'Draft' }

      act(() => {
        result.current.addEntry(newEntry, '# Draft')
        result.current.trackUnsaved('/vault/note/draft.md')
      })

      // addEntry also calls trackNew, so path is in both newPaths and unsavedPaths
      expect(result.current.getNoteStatus('/vault/note/draft.md')).toBe('unsaved')
    })

    it('clearUnsaved transitions from unsaved to new', async () => {
      const { result } = await renderVaultLoader()
      const newEntry: VaultEntry = { ...mockEntries[0], path: '/vault/note/draft.md', filename: 'draft.md', title: 'Draft' }

      act(() => {
        result.current.addEntry(newEntry, '# Draft')
        result.current.trackUnsaved('/vault/note/draft.md')
      })

      expect(result.current.getNoteStatus('/vault/note/draft.md')).toBe('unsaved')

      act(() => { result.current.clearUnsaved('/vault/note/draft.md') })

      expect(result.current.getNoteStatus('/vault/note/draft.md')).toBe('new')
    })

    it('treats untracked files as new (green dot, not orange)', async () => {
      mockInvokeFn.mockImplementation(((cmd: string) => {
        if (cmd === 'list_vault') return Promise.resolve(mockEntries)
        if (cmd === 'get_all_content') return Promise.resolve(mockContent)
        if (cmd === 'get_modified_files') return Promise.resolve([
          { path: '/vault/note/hello.md', relativePath: 'note/hello.md', status: 'untracked' },
        ])
        return Promise.resolve(null)
      }) as typeof defaultMockInvoke)

      const { result } = renderHook(() => useVaultLoader('/vault'))

      await waitFor(() => {
        expect(result.current.modifiedFiles).toHaveLength(1)
      })

      expect(result.current.getNoteStatus('/vault/note/hello.md')).toBe('new')
    })
  })

  describe('loadGitHistory', () => {
    it('returns git commits for a file', async () => {
      const { result } = renderHook(() => useVaultLoader('/vault'))

      await waitFor(() => {
        expect(result.current.entries).toHaveLength(1)
      })

      let history: GitCommit[] = []
      await act(async () => {
        history = await result.current.loadGitHistory('/vault/note/hello.md')
      })

      expect(history).toHaveLength(1)
      expect(history[0].shortHash).toBe('abc1234')
    })

    it('returns empty array on error', async () => {
      mockInvokeFn.mockImplementation(((cmd: string) => {
        if (cmd === 'get_file_history') return Promise.reject(new Error('fail'))
        if (cmd === 'list_vault') return Promise.resolve([])
        if (cmd === 'get_all_content') return Promise.resolve({})
        if (cmd === 'get_modified_files') return Promise.resolve([])
        return Promise.resolve(null)
      }) as typeof defaultMockInvoke)

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const { result } = renderHook(() => useVaultLoader('/vault'))

      let history: GitCommit[] = []
      await act(async () => {
        history = await result.current.loadGitHistory('/vault/note/hello.md')
      })

      expect(history).toEqual([])
      warnSpy.mockRestore()
    })
  })

  describe('loadDiff', () => {
    it('returns diff string for a file', async () => {
      const { result } = renderHook(() => useVaultLoader('/vault'))

      await waitFor(() => {
        expect(result.current.entries).toHaveLength(1)
      })

      let diff = ''
      await act(async () => {
        diff = await result.current.loadDiff('/vault/note/hello.md')
      })

      expect(diff).toContain('--- a/note.md')
    })
  })

  describe('loadDiffAtCommit', () => {
    it('returns diff for a specific commit', async () => {
      const { result } = renderHook(() => useVaultLoader('/vault'))

      await waitFor(() => {
        expect(result.current.entries).toHaveLength(1)
      })

      let diff = ''
      await act(async () => {
        diff = await result.current.loadDiffAtCommit('/vault/note/hello.md', 'abc1234')
      })

      expect(diff).toBe('diff for abc1234')
    })
  })

  describe('commitAndPush', () => {
    it('commits and pushes in mock mode', async () => {
      const { result } = renderHook(() => useVaultLoader('/vault'))

      await waitFor(() => {
        expect(result.current.entries).toHaveLength(1)
      })

      let response = ''
      await act(async () => {
        response = await result.current.commitAndPush('test commit')
      })

      expect(response).toBe('Committed and pushed')
    })
  })

  describe('loadModifiedFiles', () => {
    it('refreshes modified files list', async () => {
      const { result } = renderHook(() => useVaultLoader('/vault'))

      await waitFor(() => {
        expect(result.current.modifiedFiles).toHaveLength(1)
      })

      await act(async () => {
        await result.current.loadModifiedFiles()
      })

      expect(result.current.modifiedFiles).toHaveLength(1)
    })
  })
})

describe('resolveNoteStatus', () => {
  const mf = (path: string, status: string): ModifiedFile => ({ path, relativePath: path.replace('/vault/', ''), status })

  it('returns new when path is in newPaths (not yet on disk)', () => {
    expect(resolveNoteStatus('/vault/x.md', new Set(['/vault/x.md']), [])).toBe('new')
  })

  it('returns new for untracked files in git', () => {
    expect(resolveNoteStatus('/vault/x.md', new Set(), [mf('/vault/x.md', 'untracked')])).toBe('new')
  })

  it('returns new for added files in git', () => {
    expect(resolveNoteStatus('/vault/x.md', new Set(), [mf('/vault/x.md', 'added')])).toBe('new')
  })

  it('returns modified for git-modified files', () => {
    expect(resolveNoteStatus('/vault/x.md', new Set(), [mf('/vault/x.md', 'modified')])).toBe('modified')
  })

  it('returns clean for files not in git status', () => {
    expect(resolveNoteStatus('/vault/x.md', new Set(), [])).toBe('clean')
  })

  it('returns clean for deleted files', () => {
    expect(resolveNoteStatus('/vault/x.md', new Set(), [mf('/vault/x.md', 'deleted')])).toBe('clean')
  })

  it('newPaths takes priority over git modified', () => {
    expect(resolveNoteStatus('/vault/x.md', new Set(['/vault/x.md']), [mf('/vault/x.md', 'modified')])).toBe('new')
  })

  it('pendingSave takes priority over new status', () => {
    const pendingSave = new Set(['/vault/x.md'])
    expect(resolveNoteStatus('/vault/x.md', new Set(['/vault/x.md']), [], pendingSave)).toBe('pendingSave')
  })

  it('pendingSave takes priority over modified status', () => {
    const pendingSave = new Set(['/vault/x.md'])
    expect(resolveNoteStatus('/vault/x.md', new Set(), [mf('/vault/x.md', 'modified')], pendingSave)).toBe('pendingSave')
  })

  it('pendingSave takes priority over clean status', () => {
    const pendingSave = new Set(['/vault/x.md'])
    expect(resolveNoteStatus('/vault/x.md', new Set(), [], pendingSave)).toBe('pendingSave')
  })

  it('without pendingSavePaths parameter, behavior is unchanged', () => {
    // Omitting the optional parameter should produce the same results as before
    expect(resolveNoteStatus('/vault/x.md', new Set(['/vault/x.md']), [])).toBe('new')
    expect(resolveNoteStatus('/vault/x.md', new Set(), [mf('/vault/x.md', 'modified')])).toBe('modified')
    expect(resolveNoteStatus('/vault/x.md', new Set(), [])).toBe('clean')
  })

  it('empty pendingSavePaths set does not affect other statuses', () => {
    const emptyPending = new Set<string>()
    expect(resolveNoteStatus('/vault/x.md', new Set(['/vault/x.md']), [], emptyPending)).toBe('new')
    expect(resolveNoteStatus('/vault/x.md', new Set(), [mf('/vault/x.md', 'modified')], emptyPending)).toBe('modified')
    expect(resolveNoteStatus('/vault/x.md', new Set(), [], emptyPending)).toBe('clean')
  })

  it('unsaved takes priority over all other statuses', () => {
    const unsaved = new Set(['/vault/x.md'])
    expect(resolveNoteStatus('/vault/x.md', new Set(['/vault/x.md']), [], undefined, unsaved)).toBe('unsaved')
    expect(resolveNoteStatus('/vault/x.md', new Set(), [mf('/vault/x.md', 'modified')], undefined, unsaved)).toBe('unsaved')
    expect(resolveNoteStatus('/vault/x.md', new Set(['/vault/x.md']), [], new Set(['/vault/x.md']), unsaved)).toBe('unsaved')
  })

  it('without unsavedPaths parameter, behavior is unchanged', () => {
    expect(resolveNoteStatus('/vault/x.md', new Set(['/vault/x.md']), [])).toBe('new')
    expect(resolveNoteStatus('/vault/x.md', new Set(), [mf('/vault/x.md', 'modified')])).toBe('modified')
  })
})
