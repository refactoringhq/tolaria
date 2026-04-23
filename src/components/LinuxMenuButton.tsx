import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'

type MenuLeaf =
  | { kind: 'separator' }
  | { kind: 'item'; label: string; shortcut?: string; menuId?: string; action?: () => void }

type Submenu = {
  label: string
  items: ReadonlyArray<MenuLeaf>
}

const SUBMENUS: ReadonlyArray<Submenu> = [
  {
    label: 'File',
    items: [
      { kind: 'item', label: 'New Note',  shortcut: 'Ctrl+N', menuId: 'file-new-note' },
      { kind: 'item', label: 'New Type',                          menuId: 'file-new-type' },
      { kind: 'item', label: 'Quick Open', shortcut: 'Ctrl+P',   menuId: 'file-quick-open' },
      { kind: 'separator' },
      { kind: 'item', label: 'Save',       shortcut: 'Ctrl+S',   menuId: 'file-save' },
    ],
  },
  {
    label: 'Edit',
    items: [
      { kind: 'item', label: 'Find in Vault',           shortcut: 'Ctrl+Shift+F', menuId: 'edit-find-in-vault' },
      { kind: 'item', label: 'Toggle Note List Search', shortcut: 'Ctrl+F',       menuId: 'edit-toggle-note-list-search' },
      { kind: 'item', label: 'Toggle Diff Mode',                                  menuId: 'edit-toggle-diff' },
    ],
  },
  {
    label: 'View',
    items: [
      { kind: 'item', label: 'Editor Only',     shortcut: 'Ctrl+1', menuId: 'view-editor-only' },
      { kind: 'item', label: 'Editor + Notes',  shortcut: 'Ctrl+2', menuId: 'view-editor-list' },
      { kind: 'item', label: 'All Panels',      shortcut: 'Ctrl+3', menuId: 'view-all' },
      { kind: 'separator' },
      { kind: 'item', label: 'Toggle Properties Panel',          menuId: 'view-toggle-properties' },
      { kind: 'separator' },
      { kind: 'item', label: 'Zoom In',         shortcut: 'Ctrl+=', menuId: 'view-zoom-in' },
      { kind: 'item', label: 'Zoom Out',        shortcut: 'Ctrl+-', menuId: 'view-zoom-out' },
      { kind: 'item', label: 'Actual Size',     shortcut: 'Ctrl+0', menuId: 'view-zoom-reset' },
      { kind: 'separator' },
      { kind: 'item', label: 'Command Palette', shortcut: 'Ctrl+K', menuId: 'view-command-palette' },
    ],
  },
  {
    label: 'Go',
    items: [
      { kind: 'item', label: 'All Notes',  menuId: 'go-all-notes' },
      { kind: 'item', label: 'Archived',   menuId: 'go-archived' },
      { kind: 'item', label: 'Changes',    menuId: 'go-changes' },
      { kind: 'item', label: 'Inbox',      menuId: 'go-inbox' },
      { kind: 'separator' },
      { kind: 'item', label: 'Go Back',    shortcut: 'Ctrl+←', menuId: 'view-go-back' },
      { kind: 'item', label: 'Go Forward', shortcut: 'Ctrl+→', menuId: 'view-go-forward' },
    ],
  },
  {
    label: 'Note',
    items: [
      { kind: 'item', label: 'Toggle Organized', shortcut: 'Ctrl+E',         menuId: 'note-toggle-organized' },
      { kind: 'item', label: 'Archive Note',                                 menuId: 'note-archive' },
      { kind: 'item', label: 'Delete Note',      shortcut: 'Ctrl+Backspace', menuId: 'note-delete' },
      { kind: 'item', label: 'Restore Deleted Note',                         menuId: 'note-restore-deleted' },
      { kind: 'separator' },
      { kind: 'item', label: 'Open in New Window', shortcut: 'Ctrl+Shift+O', menuId: 'note-open-in-new-window' },
      { kind: 'separator' },
      { kind: 'item', label: 'Toggle Raw Editor', shortcut: 'Ctrl+\\',       menuId: 'edit-toggle-raw-editor' },
      { kind: 'item', label: 'Toggle AI Panel',   shortcut: 'Ctrl+Shift+L',  menuId: 'view-toggle-ai-chat' },
      { kind: 'item', label: 'Toggle Backlinks',                             menuId: 'view-toggle-backlinks' },
    ],
  },
  {
    label: 'Vault',
    items: [
      { kind: 'item', label: 'Open Vault…',              menuId: 'vault-open' },
      { kind: 'item', label: 'Remove Vault from List',   menuId: 'vault-remove' },
      { kind: 'item', label: 'Restore Getting Started',  menuId: 'vault-restore-getting-started' },
      { kind: 'separator' },
      { kind: 'item', label: 'Add Remote…',              menuId: 'vault-add-remote' },
      { kind: 'item', label: 'Commit & Push',            menuId: 'vault-commit-push' },
      { kind: 'item', label: 'Pull from Remote',         menuId: 'vault-pull' },
      { kind: 'item', label: 'Resolve Conflicts',        menuId: 'vault-resolve-conflicts' },
      { kind: 'item', label: 'View Pending Changes',     menuId: 'vault-view-changes' },
      { kind: 'separator' },
      { kind: 'item', label: 'Reload Vault',             menuId: 'vault-reload' },
      { kind: 'item', label: 'Repair Vault',             menuId: 'vault-repair' },
      { kind: 'item', label: 'Set Up External AI Tools…', menuId: 'vault-install-mcp' },
    ],
  },
  {
    label: 'Window',
    items: [
      { kind: 'item', label: 'Minimize', action: () => { getCurrentWindow().minimize().catch(() => {}) } },
      { kind: 'item', label: 'Maximize', action: () => { getCurrentWindow().toggleMaximize().catch(() => {}) } },
      { kind: 'separator' },
      { kind: 'item', label: 'Close',    action: () => { getCurrentWindow().close().catch(() => {}) } },
    ],
  },
]

function triggerMenuId(menuId: string) {
  invoke('trigger_menu_command', { id: menuId }).catch(() => {})
}

function HamburgerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <line x1="2" y1="4"  x2="12" y2="4" />
      <line x1="2" y1="7"  x2="12" y2="7" />
      <line x1="2" y1="10" x2="12" y2="10" />
    </svg>
  )
}

export function LinuxMenuButton() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Application menu"
          style={{ width: 38, height: '100%' }}
          className="flex items-center justify-center text-foreground/70 hover:bg-foreground/10 transition-colors duration-100"
          data-no-drag
        >
          <HamburgerIcon />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={0} className="min-w-[200px]">
        {SUBMENUS.map((submenu) => (
          <DropdownMenuSub key={submenu.label}>
            <DropdownMenuSubTrigger>{submenu.label}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="min-w-[220px]">
              {submenu.items.map((item, idx) =>
                item.kind === 'separator'
                  ? <DropdownMenuSeparator key={`sep-${submenu.label}-${idx}`} />
                  : (
                    <DropdownMenuItem
                      key={`${submenu.label}-${item.label}`}
                      onSelect={() => {
                        if (item.action) item.action()
                        else if (item.menuId) triggerMenuId(item.menuId)
                      }}
                    >
                      <span>{item.label}</span>
                      {item.shortcut && <DropdownMenuShortcut>{item.shortcut}</DropdownMenuShortcut>}
                    </DropdownMenuItem>
                  ),
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
