import { act, renderHook, waitFor } from '@testing-library/react'
import { invoke } from '@tauri-apps/api/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isTauri } from '../mock-tauri'
import type { NoteCreationConfig } from './useNoteCreation'
import { useNoteCreation } from './useNoteCreation'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('../mock-tauri', () => ({
  isTauri: vi.fn(() => false),
  addMockEntry: vi.fn(),
  updateMockContent: vi.fn(),
  trackMockChange: vi.fn(),
  mockInvoke: vi.fn().mockResolvedValue(''),
}))

describe('immediate note persistence', () => {
  const addEntry = vi.fn()
  const removeEntry = vi.fn()
  const setToastMessage = vi.fn()
  const openTabWithContent = vi.fn()
  const makeConfig = (): NoteCreationConfig => ({
    addEntry,
    removeEntry,
    entries: [],
    setToastMessage,
    vaultPath: '/test/vault',
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isTauri).mockReturnValue(false)
  })

  it('creates the backing file before opening the note', async () => {
    vi.mocked(isTauri).mockReturnValue(true)
    vi.mocked(invoke).mockResolvedValueOnce(undefined)
    const addPendingSave = vi.fn()
    const removePendingSave = vi.fn()
    const onNewNotePersisted = vi.fn()
    const config = {
      ...makeConfig(),
      addPendingSave,
      removePendingSave,
      onNewNotePersisted,
    }
    const { result } = renderHook(() => useNoteCreation(config, { openTabWithContent }))

    act(() => { result.current.handleCreateNoteImmediate() })
    await waitFor(() => { expect(addEntry).toHaveBeenCalledOnce() })

    const createdPath = expect.stringMatching(/untitled-note-\d+\.md$/)
    expect(vi.mocked(invoke)).toHaveBeenCalledWith('create_note_content', {
      path: createdPath,
      content: expect.stringContaining('type: Note'),
      vaultPath: '/test/vault',
    })
    expect(addPendingSave).toHaveBeenCalledWith(createdPath)
    expect(removePendingSave).toHaveBeenCalledWith(createdPath)
    expect(onNewNotePersisted).toHaveBeenCalledWith(createdPath)
    expect(openTabWithContent).toHaveBeenCalledOnce()
    expect(vi.mocked(invoke).mock.invocationCallOrder[0]).toBeLessThan(
      openTabWithContent.mock.invocationCallOrder[0],
    )
  })

  it('starts a calendar note with its day prefilled in frontmatter and on the entry', async () => {
    vi.mocked(isTauri).mockReturnValue(true)
    vi.mocked(invoke).mockResolvedValueOnce(undefined)
    const { result } = renderHook(() => useNoteCreation(makeConfig(), { openTabWithContent }))

    act(() => { result.current.handleCreateNoteImmediate('Project', { creationPath: 'calendar_day', properties: { due: '2026-11-24' } }) })
    await waitFor(() => { expect(addEntry).toHaveBeenCalledOnce() })

    expect(vi.mocked(invoke)).toHaveBeenCalledWith('create_note_content', expect.objectContaining({
      content: expect.stringMatching(/^---\ntype: Project\ndue: 2026-11-24\n---/),
    }))
    expect(addEntry.mock.calls[0][0].properties).toMatchObject({ due: '2026-11-24' })
  })

  it('does not open an optimistic note when disk creation fails', async () => {
    vi.mocked(isTauri).mockReturnValue(true)
    vi.mocked(invoke).mockRejectedValueOnce(new Error('disk full'))
    const { result } = renderHook(() => useNoteCreation(makeConfig(), { openTabWithContent }))

    act(() => { result.current.handleCreateNoteImmediate() })
    await waitFor(() => {
      expect(setToastMessage).toHaveBeenCalledWith('Failed to create note — disk write error')
    })

    expect(addEntry).not.toHaveBeenCalled()
    expect(openTabWithContent).not.toHaveBeenCalled()
  })

  it('requests editor focus for the new path', async () => {
    const focusEvent = new Promise<CustomEvent>((resolve) => {
      window.addEventListener(
        'laputa:focus-editor',
        (event) => { resolve(event as CustomEvent) },
        { once: true },
      )
    })
    const { result } = renderHook(() => useNoteCreation(makeConfig(), { openTabWithContent }))

    act(() => { result.current.handleCreateNoteImmediate() })
    const event = await focusEvent

    expect(event.detail.path).toMatch(/\/test\/vault\/untitled-note-\d+\.md$/)
    expect(event.detail.selectTitle).toBe(true)
  })
})
