import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useWebRouting } from './useWebRouting'
import type { SidebarSelection, VaultEntry } from '../types'

// Mock isTauri to simulate web environment
vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: vi.fn(),
}))

function createEntry(path: string, title = path): VaultEntry {
  return {
    path,
    filename: path.split('/').pop() || path,
    title,
    isA: null,
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: null,
    archived: false,
    modifiedAt: null,
    createdAt: null,
    fileSize: 0,
    snippet: '',
    wordCount: 0,
    relationships: {},
    icon: null,
    color: null,
    order: null,
    sidebarLabel: null,
    template: null,
    sort: null,
    view: null,
    visible: null,
    organized: false,
    favorite: false,
    favoriteIndex: null,
    listPropertiesDisplay: [],
    outgoingLinks: [],
    properties: {},
    hasH1: false,
  }
}

describe('useWebRouting', () => {
  let mockPushState: ReturnType<typeof vi.fn>
  let mockAddEventListener: ReturnType<typeof vi.fn>
  let mockRemoveEventListener: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockPushState = vi.fn()
    mockAddEventListener = vi.fn()
    mockRemoveEventListener = vi.fn()

    Object.defineProperty(window, 'history', {
      value: { pushState: mockPushState },
      writable: true,
    })

    Object.defineProperty(window, 'location', {
      value: { pathname: '/' },
      writable: true,
    })

    window.addEventListener = mockAddEventListener
    window.removeEventListener = mockRemoveEventListener
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should not activate when disabled (desktop mode)', () => {
    const onSelectNote = vi.fn()
    const onSetSelection = vi.fn()

    renderHook(() =>
      useWebRouting({
        selection: { kind: 'filter', filter: 'inbox' },
        onSelectNote,
        onSetSelection,
        entries: [],
        views: [],
        enabled: false,
      }),
    )

    expect(mockPushState).not.toHaveBeenCalled()
    expect(mockAddEventListener).not.toHaveBeenCalledWith('popstate', expect.any(Function))
  })

  it('should push URL when note is selected', () => {
    const entry = createEntry('notes/work.md')
    const selection: SidebarSelection = { kind: 'entity', entry }
    const onSelectNote = vi.fn()
    const onSetSelection = vi.fn()

    renderHook(() =>
      useWebRouting({
        selection,
        onSelectNote,
        onSetSelection,
        entries: [entry],
        views: [],
        enabled: true,
      }),
    )

    expect(mockPushState).toHaveBeenCalledWith(null, '', '/note/notes/work.md')
  })

  it('should push URL when view is selected', () => {
    const selection: SidebarSelection = { kind: 'view', filename: 'my-view.view.md' }
    const onSelectNote = vi.fn()
    const onSetSelection = vi.fn()

    renderHook(() =>
      useWebRouting({
        selection,
        onSelectNote,
        onSetSelection,
        entries: [],
        views: [{ definition: { name: 'My View' }, filename: 'my-view.view.md' }],
        enabled: true,
      }),
    )

    expect(mockPushState).toHaveBeenCalledWith(null, '', '/view/my-view.view.md')
  })

  it('should push home URL for non-note selections', () => {
    const selection: SidebarSelection = { kind: 'filter', filter: 'inbox' }
    const onSelectNote = vi.fn()
    const onSetSelection = vi.fn()

    renderHook(() =>
      useWebRouting({
        selection,
        onSelectNote,
        onSetSelection,
        entries: [],
        views: [],
        enabled: true,
      }),
    )

    expect(mockPushState).toHaveBeenCalledWith(null, '', '/')
  })

  it('should percent-encode spaces in note paths', () => {
    const entry = createEntry('folder/note with spaces.md')
    const selection: SidebarSelection = { kind: 'entity', entry }
    const onSelectNote = vi.fn()
    const onSetSelection = vi.fn()

    renderHook(() =>
      useWebRouting({
        selection,
        onSelectNote,
        onSetSelection,
        entries: [entry],
        views: [],
        enabled: true,
      }),
    )

    expect(mockPushState).toHaveBeenCalledWith(null, '', '/note/folder/note%20with%20spaces.md')
  })

  it('should percent-encode unicode in note paths', () => {
    const entry = createEntry('notes/日本語.md')
    const selection: SidebarSelection = { kind: 'entity', entry }
    const onSelectNote = vi.fn()
    const onSetSelection = vi.fn()

    renderHook(() =>
      useWebRouting({
        selection,
        onSelectNote,
        onSetSelection,
        entries: [entry],
        views: [],
        enabled: true,
      }),
    )

    expect(mockPushState).toHaveBeenCalledWith(
      null,
      '',
      '/note/notes/%E6%97%A5%E6%9C%AC%E8%AA%9E.md',
    )
  })

  it('should restore note selection from URL on mount', () => {
    const entry = createEntry('notes/work.md')
    const onSelectNote = vi.fn()
    const onSetSelection = vi.fn()

    Object.defineProperty(window, 'location', {
      value: { pathname: '/note/notes/work.md' },
      writable: true,
    })

    renderHook(() =>
      useWebRouting({
        selection: { kind: 'filter', filter: 'inbox' },
        onSelectNote,
        onSetSelection,
        entries: [entry],
        views: [],
        enabled: true,
      }),
    )

    expect(onSelectNote).toHaveBeenCalledWith(entry)
  })

  it('should restore view selection from URL on mount', () => {
    const onSelectNote = vi.fn()
    const onSetSelection = vi.fn()
    const view = { definition: { name: 'My View' }, filename: 'my-view.view.md' }

    Object.defineProperty(window, 'location', {
      value: { pathname: '/view/my-view.view.md' },
      writable: true,
    })

    renderHook(() =>
      useWebRouting({
        selection: { kind: 'filter', filter: 'inbox' },
        onSelectNote,
        onSetSelection,
        entries: [],
        views: [view],
        enabled: true,
      }),
    )

    expect(onSetSelection).toHaveBeenCalledWith({
      kind: 'view',
      filename: 'my-view.view.md',
      rootPath: undefined,
    })
  })

  it('should register popstate listener when enabled', () => {
    const onSelectNote = vi.fn()
    const onSetSelection = vi.fn()

    renderHook(() =>
      useWebRouting({
        selection: { kind: 'filter', filter: 'inbox' },
        onSelectNote,
        onSetSelection,
        entries: [],
        views: [],
        enabled: true,
      }),
    )

    expect(mockAddEventListener).toHaveBeenCalledWith('popstate', expect.any(Function))
  })

  it('should unregister popstate listener on unmount', () => {
    const onSelectNote = vi.fn()
    const onSetSelection = vi.fn()

    const { unmount } = renderHook(() =>
      useWebRouting({
        selection: { kind: 'filter', filter: 'inbox' },
        onSelectNote,
        onSetSelection,
        entries: [],
        views: [],
        enabled: true,
      }),
    )

    unmount()

    expect(mockRemoveEventListener).toHaveBeenCalledWith('popstate', expect.any(Function))
  })
})
