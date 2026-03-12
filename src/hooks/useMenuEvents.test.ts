import { describe, it, expect, vi } from 'vitest'
import { dispatchMenuEvent, type MenuEventHandlers } from './useMenuEvents'

function makeHandlers(): MenuEventHandlers {
  return {
    onSetViewMode: vi.fn(),
    onCreateNote: vi.fn(),
    onCreateType: vi.fn(),
    onOpenDailyNote: vi.fn(),
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
    onToggleRawEditor: vi.fn(),
    onToggleDiff: vi.fn(),
    onToggleAIChat: vi.fn(),
    onGoBack: vi.fn(),
    onGoForward: vi.fn(),
    onCheckForUpdates: vi.fn(),
    onSelectFilter: vi.fn(),
    onOpenVault: vi.fn(),
    onRemoveActiveVault: vi.fn(),
    onRestoreGettingStarted: vi.fn(),
    onCreateTheme: vi.fn(),
    onRestoreDefaultThemes: vi.fn(),
    onCommitPush: vi.fn(),
    onResolveConflicts: vi.fn(),
    onViewChanges: vi.fn(),
    onInstallMcp: vi.fn(),
    onReindexVault: vi.fn(),
    onReloadVault: vi.fn(),
    onReopenClosedTab: vi.fn(),
    activeTabPathRef: { current: '/vault/test.md' } as React.MutableRefObject<string | null>,
    handleCloseTabRef: { current: vi.fn() } as React.MutableRefObject<(path: string) => void>,
    activeTabPath: '/vault/test.md',
  }
}

describe('dispatchMenuEvent', () => {
  // View mode events
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

  // Simple handler events
  it('file-new-note triggers create note', () => {
    const h = makeHandlers()
    dispatchMenuEvent('file-new-note', h)
    expect(h.onCreateNote).toHaveBeenCalled()
  })

  it('file-daily-note triggers open daily note', () => {
    const h = makeHandlers()
    dispatchMenuEvent('file-daily-note', h)
    expect(h.onOpenDailyNote).toHaveBeenCalled()
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

  it('view-toggle-properties triggers toggle inspector', () => {
    const h = makeHandlers()
    dispatchMenuEvent('view-toggle-properties', h)
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

  it('edit-find-in-vault triggers search', () => {
    const h = makeHandlers()
    dispatchMenuEvent('edit-find-in-vault', h)
    expect(h.onSearch).toHaveBeenCalled()
  })

  // Active tab-dependent events
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

  // Optional handler events
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

  it('app-check-for-updates triggers check for updates', () => {
    const h = makeHandlers()
    dispatchMenuEvent('app-check-for-updates', h)
    expect(h.onCheckForUpdates).toHaveBeenCalled()
  })

  // New File menu items
  it('file-new-type triggers create type', () => {
    const h = makeHandlers()
    dispatchMenuEvent('file-new-type', h)
    expect(h.onCreateType).toHaveBeenCalled()
  })

  // New Edit menu items
  it('edit-toggle-raw-editor triggers toggle raw editor', () => {
    const h = makeHandlers()
    dispatchMenuEvent('edit-toggle-raw-editor', h)
    expect(h.onToggleRawEditor).toHaveBeenCalled()
  })

  it('edit-toggle-diff triggers toggle diff', () => {
    const h = makeHandlers()
    dispatchMenuEvent('edit-toggle-diff', h)
    expect(h.onToggleDiff).toHaveBeenCalled()
  })

  // New View menu items
  it('view-toggle-ai-chat triggers toggle AI chat', () => {
    const h = makeHandlers()
    dispatchMenuEvent('view-toggle-ai-chat', h)
    expect(h.onToggleAIChat).toHaveBeenCalled()
  })

  it('view-toggle-backlinks triggers toggle inspector', () => {
    const h = makeHandlers()
    dispatchMenuEvent('view-toggle-backlinks', h)
    expect(h.onToggleInspector).toHaveBeenCalled()
  })

  // Go menu events
  it('go-all-notes selects all filter', () => {
    const h = makeHandlers()
    dispatchMenuEvent('go-all-notes', h)
    expect(h.onSelectFilter).toHaveBeenCalledWith('all')
  })

  it('go-archived selects archived filter', () => {
    const h = makeHandlers()
    dispatchMenuEvent('go-archived', h)
    expect(h.onSelectFilter).toHaveBeenCalledWith('archived')
  })

  it('go-trash selects trash filter', () => {
    const h = makeHandlers()
    dispatchMenuEvent('go-trash', h)
    expect(h.onSelectFilter).toHaveBeenCalledWith('trash')
  })

  it('go-changes selects changes filter', () => {
    const h = makeHandlers()
    dispatchMenuEvent('go-changes', h)
    expect(h.onSelectFilter).toHaveBeenCalledWith('changes')
  })

  // Vault menu events
  it('vault-open triggers open vault', () => {
    const h = makeHandlers()
    dispatchMenuEvent('vault-open', h)
    expect(h.onOpenVault).toHaveBeenCalled()
  })

  it('vault-remove triggers remove active vault', () => {
    const h = makeHandlers()
    dispatchMenuEvent('vault-remove', h)
    expect(h.onRemoveActiveVault).toHaveBeenCalled()
  })

  it('vault-restore-getting-started triggers restore', () => {
    const h = makeHandlers()
    dispatchMenuEvent('vault-restore-getting-started', h)
    expect(h.onRestoreGettingStarted).toHaveBeenCalled()
  })

  it('vault-new-theme triggers create theme', () => {
    const h = makeHandlers()
    dispatchMenuEvent('vault-new-theme', h)
    expect(h.onCreateTheme).toHaveBeenCalled()
  })

  it('vault-restore-default-themes triggers restore default themes', () => {
    const h = makeHandlers()
    dispatchMenuEvent('vault-restore-default-themes', h)
    expect(h.onRestoreDefaultThemes).toHaveBeenCalled()
  })

  it('vault-commit-push triggers commit push', () => {
    const h = makeHandlers()
    dispatchMenuEvent('vault-commit-push', h)
    expect(h.onCommitPush).toHaveBeenCalled()
  })

  it('vault-resolve-conflicts triggers resolve conflicts', () => {
    const h = makeHandlers()
    dispatchMenuEvent('vault-resolve-conflicts', h)
    expect(h.onResolveConflicts).toHaveBeenCalled()
  })

  it('vault-view-changes triggers view changes', () => {
    const h = makeHandlers()
    dispatchMenuEvent('vault-view-changes', h)
    expect(h.onViewChanges).toHaveBeenCalled()
  })

  it('vault-install-mcp triggers install MCP', () => {
    const h = makeHandlers()
    dispatchMenuEvent('vault-install-mcp', h)
    expect(h.onInstallMcp).toHaveBeenCalled()
  })

  it('vault-reindex triggers reindex vault', () => {
    const h = makeHandlers()
    dispatchMenuEvent('vault-reindex', h)
    expect(h.onReindexVault).toHaveBeenCalled()
  })

  it('vault-reload triggers reload vault', () => {
    const h = makeHandlers()
    dispatchMenuEvent('vault-reload', h)
    expect(h.onReloadVault).toHaveBeenCalled()
  })

  // File menu: reopen closed tab
  it('file-reopen-closed-tab triggers reopen closed tab', () => {
    const h = makeHandlers()
    dispatchMenuEvent('file-reopen-closed-tab', h)
    expect(h.onReopenClosedTab).toHaveBeenCalled()
  })

  // Edge cases
  it('unknown event ID does nothing', () => {
    const h = makeHandlers()
    dispatchMenuEvent('unknown-event', h)
    expect(h.onSetViewMode).not.toHaveBeenCalled()
    expect(h.onCreateNote).not.toHaveBeenCalled()
    expect(h.onSave).not.toHaveBeenCalled()
  })
})
