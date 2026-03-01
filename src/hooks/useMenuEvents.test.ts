import { describe, it, expect, vi } from 'vitest'
import { dispatchMenuEvent, type MenuEventHandlers } from './useMenuEvents'

function makeHandlers(): MenuEventHandlers {
  return {
    onSetViewMode: vi.fn(),
    onCreateNote: vi.fn(),
    onQuickOpen: vi.fn(),
    onSave: vi.fn(),
    onOpenSettings: vi.fn(),
    onToggleInspector: vi.fn(),
    onCommandPalette: vi.fn(),
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onZoomReset: vi.fn(),
    onArchiveNote: vi.fn(),
    onTrashNote: vi.fn(),
    onSearch: vi.fn(),
    onGoBack: vi.fn(),
    onGoForward: vi.fn(),
    activeTabPathRef: { current: '/vault/test.md' } as React.MutableRefObject<string | null>,
    handleCloseTabRef: { current: vi.fn() } as React.MutableRefObject<(path: string) => void>,
    activeTabPath: '/vault/test.md',
  }
}

describe('dispatchMenuEvent', () => {
  it('view-editor-only sets editor-only mode', () => {
    const h = makeHandlers()
    dispatchMenuEvent('view-editor-only', h)
    expect(h.onSetViewMode).toHaveBeenCalledWith('editor-only')
  })

  it('view-editor-list sets editor-list mode', () => {
    const h = makeHandlers()
    dispatchMenuEvent('view-editor-list', h)
    expect(h.onSetViewMode).toHaveBeenCalledWith('editor-list')
  })

  it('view-all sets all mode', () => {
    const h = makeHandlers()
    dispatchMenuEvent('view-all', h)
    expect(h.onSetViewMode).toHaveBeenCalledWith('all')
  })

  it('file-new-note triggers create note', () => {
    const h = makeHandlers()
    dispatchMenuEvent('file-new-note', h)
    expect(h.onCreateNote).toHaveBeenCalled()
  })

  it('file-quick-open triggers quick open', () => {
    const h = makeHandlers()
    dispatchMenuEvent('file-quick-open', h)
    expect(h.onQuickOpen).toHaveBeenCalled()
  })

  it('file-save triggers save', () => {
    const h = makeHandlers()
    dispatchMenuEvent('file-save', h)
    expect(h.onSave).toHaveBeenCalled()
  })

  it('file-close-tab closes the active tab', () => {
    const h = makeHandlers()
    dispatchMenuEvent('file-close-tab', h)
    expect(h.handleCloseTabRef.current).toHaveBeenCalledWith('/vault/test.md')
  })

  it('file-close-tab does nothing when no active tab', () => {
    const h = makeHandlers()
    h.activeTabPathRef = { current: null }
    dispatchMenuEvent('file-close-tab', h)
    expect(h.handleCloseTabRef.current).not.toHaveBeenCalled()
  })

  it('app-settings triggers open settings', () => {
    const h = makeHandlers()
    dispatchMenuEvent('app-settings', h)
    expect(h.onOpenSettings).toHaveBeenCalled()
  })

  it('view-toggle-inspector triggers toggle inspector', () => {
    const h = makeHandlers()
    dispatchMenuEvent('view-toggle-inspector', h)
    expect(h.onToggleInspector).toHaveBeenCalled()
  })

  it('view-command-palette triggers command palette', () => {
    const h = makeHandlers()
    dispatchMenuEvent('view-command-palette', h)
    expect(h.onCommandPalette).toHaveBeenCalled()
  })

  it('view-zoom-in triggers zoom in', () => {
    const h = makeHandlers()
    dispatchMenuEvent('view-zoom-in', h)
    expect(h.onZoomIn).toHaveBeenCalled()
  })

  it('view-zoom-out triggers zoom out', () => {
    const h = makeHandlers()
    dispatchMenuEvent('view-zoom-out', h)
    expect(h.onZoomOut).toHaveBeenCalled()
  })

  it('view-zoom-reset triggers zoom reset', () => {
    const h = makeHandlers()
    dispatchMenuEvent('view-zoom-reset', h)
    expect(h.onZoomReset).toHaveBeenCalled()
  })

  it('note-archive triggers archive on active tab', () => {
    const h = makeHandlers()
    dispatchMenuEvent('note-archive', h)
    expect(h.onArchiveNote).toHaveBeenCalledWith('/vault/test.md')
  })

  it('note-archive does nothing when no active tab', () => {
    const h = makeHandlers()
    h.activeTabPathRef = { current: null }
    dispatchMenuEvent('note-archive', h)
    expect(h.onArchiveNote).not.toHaveBeenCalled()
  })

  it('note-trash triggers trash on active tab', () => {
    const h = makeHandlers()
    dispatchMenuEvent('note-trash', h)
    expect(h.onTrashNote).toHaveBeenCalledWith('/vault/test.md')
  })

  it('note-trash does nothing when no active tab', () => {
    const h = makeHandlers()
    h.activeTabPathRef = { current: null }
    dispatchMenuEvent('note-trash', h)
    expect(h.onTrashNote).not.toHaveBeenCalled()
  })

  it('edit-find-in-vault triggers search', () => {
    const h = makeHandlers()
    dispatchMenuEvent('edit-find-in-vault', h)
    expect(h.onSearch).toHaveBeenCalled()
  })

  it('view-go-back triggers go back', () => {
    const h = makeHandlers()
    dispatchMenuEvent('view-go-back', h)
    expect(h.onGoBack).toHaveBeenCalled()
  })

  it('view-go-forward triggers go forward', () => {
    const h = makeHandlers()
    dispatchMenuEvent('view-go-forward', h)
    expect(h.onGoForward).toHaveBeenCalled()
  })

  it('unknown event ID does nothing', () => {
    const h = makeHandlers()
    dispatchMenuEvent('unknown-event', h)
    expect(h.onSetViewMode).not.toHaveBeenCalled()
    expect(h.onCreateNote).not.toHaveBeenCalled()
    expect(h.onSave).not.toHaveBeenCalled()
  })
})
