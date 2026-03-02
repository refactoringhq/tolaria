import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { VaultEntry } from '../types'
import { useEntryActions } from './useEntryActions'

const makeEntry = (overrides: Partial<VaultEntry> = {}): VaultEntry => ({
  path: '/vault/note/test.md',
  filename: 'test.md',
  title: 'Test Note',
  isA: 'Note',
  aliases: [],
  belongsTo: [],
  relatedTo: [],
  status: 'Active',
  owner: null,
  cadence: null,
  archived: false,
  trashed: false,
  trashedAt: null,
  modifiedAt: 1700000000,
  createdAt: 1700000000,
  fileSize: 100,
  snippet: '',
  wordCount: 0,
  relationships: {},
  icon: null,
  color: null,
  order: null,
  template: null,
  outgoingLinks: [],
  ...overrides,
})

describe('useEntryActions', () => {
  const updateEntry = vi.fn()
  const handleUpdateFrontmatter = vi.fn().mockResolvedValue(undefined)
  const handleDeleteProperty = vi.fn().mockResolvedValue(undefined)
  const setToastMessage = vi.fn()
  const createTypeEntry = vi.fn().mockImplementation((typeName: string) =>
    Promise.resolve(makeEntry({ isA: 'Type', title: typeName, path: `/vault/type/${typeName.toLowerCase()}.md` })),
  )

  function setup(entries: VaultEntry[] = []) {
    return renderHook(() =>
      useEntryActions({
        entries,
        updateEntry,
        handleUpdateFrontmatter,
        handleDeleteProperty,
        setToastMessage,
        createTypeEntry,
      })
    )
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('handleTrashNote', () => {
    it('sets trashed frontmatter and updates entry state', async () => {
      const { result } = setup()

      await act(async () => {
        await result.current.handleTrashNote('/vault/note/test.md')
      })

      expect(handleUpdateFrontmatter).toHaveBeenCalledWith('/vault/note/test.md', 'trashed', true)
      expect(handleUpdateFrontmatter).toHaveBeenCalledWith('/vault/note/test.md', 'trashed_at', expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/))
      expect(updateEntry).toHaveBeenCalledWith('/vault/note/test.md', {
        trashed: true,
        trashedAt: expect.any(Number),
      })
      expect(setToastMessage).toHaveBeenCalledWith('Note moved to trash')
    })
  })

  describe('handleRestoreNote', () => {
    it('clears trashed frontmatter and updates entry state', async () => {
      const { result } = setup()

      await act(async () => {
        await result.current.handleRestoreNote('/vault/note/test.md')
      })

      expect(handleUpdateFrontmatter).toHaveBeenCalledWith('/vault/note/test.md', 'trashed', false)
      expect(handleDeleteProperty).toHaveBeenCalledWith('/vault/note/test.md', 'trashed_at')
      expect(updateEntry).toHaveBeenCalledWith('/vault/note/test.md', {
        trashed: false,
        trashedAt: null,
      })
      expect(setToastMessage).toHaveBeenCalledWith('Note restored from trash')
    })
  })

  describe('handleArchiveNote', () => {
    it('sets archived frontmatter and updates entry state', async () => {
      const { result } = setup()

      await act(async () => {
        await result.current.handleArchiveNote('/vault/note/test.md')
      })

      expect(handleUpdateFrontmatter).toHaveBeenCalledWith('/vault/note/test.md', 'archived', true)
      expect(updateEntry).toHaveBeenCalledWith('/vault/note/test.md', { archived: true })
      expect(setToastMessage).toHaveBeenCalledWith('Note archived')
    })
  })

  describe('handleUnarchiveNote', () => {
    it('clears archived frontmatter and updates entry state', async () => {
      const { result } = setup()

      await act(async () => {
        await result.current.handleUnarchiveNote('/vault/note/test.md')
      })

      expect(handleUpdateFrontmatter).toHaveBeenCalledWith('/vault/note/test.md', 'archived', false)
      expect(updateEntry).toHaveBeenCalledWith('/vault/note/test.md', { archived: false })
      expect(setToastMessage).toHaveBeenCalledWith('Note unarchived')
    })
  })

  describe('handleCustomizeType', () => {
    it('updates icon and color on the type entry', async () => {
      const typeEntry = makeEntry({ isA: 'Type', title: 'Recipe', path: '/vault/type/recipe.md' })
      const { result } = setup([typeEntry])

      await act(async () => {
        await result.current.handleCustomizeType('Recipe', 'cooking-pot', 'green')
      })

      expect(handleUpdateFrontmatter).toHaveBeenCalledWith('/vault/type/recipe.md', 'icon', 'cooking-pot')
      expect(handleUpdateFrontmatter).toHaveBeenCalledWith('/vault/type/recipe.md', 'color', 'green')
      expect(updateEntry).toHaveBeenCalledWith('/vault/type/recipe.md', { icon: 'cooking-pot', color: 'green' })
    })

    it('auto-creates type entry when not found and applies customization', async () => {
      const { result } = setup([])

      await act(async () => {
        await result.current.handleCustomizeType('Recipe', 'star', 'red')
      })

      expect(createTypeEntry).toHaveBeenCalledWith('Recipe')
      expect(updateEntry).toHaveBeenCalledWith('/vault/type/recipe.md', { icon: 'star', color: 'red' })
      expect(handleUpdateFrontmatter).toHaveBeenCalledWith('/vault/type/recipe.md', 'icon', 'star')
      expect(handleUpdateFrontmatter).toHaveBeenCalledWith('/vault/type/recipe.md', 'color', 'red')
    })

    it('serializes frontmatter writes (icon before color)', async () => {
      const callOrder: string[] = []
      handleUpdateFrontmatter.mockImplementation((_path: string, key: string) => {
        callOrder.push(key)
        return Promise.resolve()
      })
      const typeEntry = makeEntry({ isA: 'Type', title: 'Project', path: '/vault/type/project.md' })
      const { result } = setup([typeEntry])

      await act(async () => {
        await result.current.handleCustomizeType('Project', 'wrench', 'blue')
      })

      expect(callOrder).toEqual(['icon', 'color'])
    })
  })

  describe('handleUpdateTypeTemplate', () => {
    it('updates template on the type entry', () => {
      const typeEntry = makeEntry({ isA: 'Type', title: 'Project', path: '/vault/type/project.md' })
      const { result } = setup([typeEntry])

      act(() => {
        result.current.handleUpdateTypeTemplate('Project', '## Objective\n\n## Notes')
      })

      expect(handleUpdateFrontmatter).toHaveBeenCalledWith('/vault/type/project.md', 'template', '## Objective\n\n## Notes')
      expect(updateEntry).toHaveBeenCalledWith('/vault/type/project.md', { template: '## Objective\n\n## Notes' })
    })

    it('sets template to null when empty string', () => {
      const typeEntry = makeEntry({ isA: 'Type', title: 'Project', path: '/vault/type/project.md' })
      const { result } = setup([typeEntry])

      act(() => {
        result.current.handleUpdateTypeTemplate('Project', '')
      })

      expect(handleUpdateFrontmatter).toHaveBeenCalledWith('/vault/type/project.md', 'template', '')
      expect(updateEntry).toHaveBeenCalledWith('/vault/type/project.md', { template: null })
    })

    it('does nothing when type entry not found', () => {
      const { result } = setup([])

      act(() => {
        result.current.handleUpdateTypeTemplate('NonExistent', '## Template')
      })

      expect(handleUpdateFrontmatter).not.toHaveBeenCalled()
      expect(updateEntry).not.toHaveBeenCalled()
    })
  })

  describe('handleReorderSections', () => {
    it('updates order on multiple type entries', () => {
      const typeA = makeEntry({ isA: 'Type', title: 'Note', path: '/vault/type/note.md' })
      const typeB = makeEntry({ isA: 'Type', title: 'Project', path: '/vault/type/project.md' })
      const { result } = setup([typeA, typeB])

      act(() => {
        result.current.handleReorderSections([
          { typeName: 'Note', order: 0 },
          { typeName: 'Project', order: 1 },
        ])
      })

      expect(handleUpdateFrontmatter).toHaveBeenCalledWith('/vault/type/note.md', 'order', 0)
      expect(handleUpdateFrontmatter).toHaveBeenCalledWith('/vault/type/project.md', 'order', 1)
      expect(updateEntry).toHaveBeenCalledWith('/vault/type/note.md', { order: 0 })
      expect(updateEntry).toHaveBeenCalledWith('/vault/type/project.md', { order: 1 })
    })

    it('skips types that are not found', () => {
      const typeA = makeEntry({ isA: 'Type', title: 'Note', path: '/vault/type/note.md' })
      const { result } = setup([typeA])

      act(() => {
        result.current.handleReorderSections([
          { typeName: 'Note', order: 0 },
          { typeName: 'Missing', order: 1 },
        ])
      })

      // Only Note's order was set; Missing was skipped
      expect(handleUpdateFrontmatter).toHaveBeenCalledTimes(1)
      expect(handleUpdateFrontmatter).toHaveBeenCalledWith('/vault/type/note.md', 'order', 0)
      expect(updateEntry).toHaveBeenCalledTimes(1)
    })
  })

  describe('handleRenameSection', () => {
    it('writes sidebar label frontmatter and updates entry in memory', async () => {
      const typeEntry = makeEntry({ isA: 'Type', title: 'Recipe', path: '/vault/type/recipe.md', sidebarLabel: null })
      const { result } = setup([typeEntry])

      await act(async () => {
        await result.current.handleRenameSection('Recipe', 'Recipes')
      })

      expect(handleUpdateFrontmatter).toHaveBeenCalledWith('/vault/type/recipe.md', 'sidebar label', 'Recipes')
      expect(updateEntry).toHaveBeenCalledWith('/vault/type/recipe.md', { sidebarLabel: 'Recipes' })
    })

    it('trims whitespace before saving', async () => {
      const typeEntry = makeEntry({ isA: 'Type', title: 'Recipe', path: '/vault/type/recipe.md', sidebarLabel: null })
      const { result } = setup([typeEntry])

      await act(async () => {
        await result.current.handleRenameSection('Recipe', '  Dishes  ')
      })

      expect(handleUpdateFrontmatter).toHaveBeenCalledWith('/vault/type/recipe.md', 'sidebar label', 'Dishes')
      expect(updateEntry).toHaveBeenCalledWith('/vault/type/recipe.md', { sidebarLabel: 'Dishes' })
    })

    it('deletes sidebar label when label is empty', async () => {
      const typeEntry = makeEntry({ isA: 'Type', title: 'Recipe', path: '/vault/type/recipe.md', sidebarLabel: 'Dishes' })
      const { result } = setup([typeEntry])

      await act(async () => {
        await result.current.handleRenameSection('Recipe', '')
      })

      expect(handleDeleteProperty).toHaveBeenCalledWith('/vault/type/recipe.md', 'sidebar label')
      expect(updateEntry).toHaveBeenCalledWith('/vault/type/recipe.md', { sidebarLabel: null })
      expect(handleUpdateFrontmatter).not.toHaveBeenCalled()
    })

    it('does nothing when type entry not found', async () => {
      const { result } = setup([])

      await act(async () => {
        await result.current.handleRenameSection('NonExistent', 'Label')
      })

      expect(handleUpdateFrontmatter).not.toHaveBeenCalled()
      expect(updateEntry).not.toHaveBeenCalled()
    })
  })
})
