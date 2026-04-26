import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { Copy } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import type { VaultEntry } from '../../types'

interface NoteContextMenuState {
  entry: VaultEntry
  x: number
  y: number
}

interface UseNoteContextMenuInput {
  vaultPath: string | null
  setToastMessage: (message: string | null) => void
}

const COPY_TOAST_OK = 'System path copied to clipboard'
const COPY_TOAST_NO_VAULT = 'Could not resolve vault path'
const COPY_TOAST_FAILED = 'Could not copy system path'

function joinSystemPath(vaultPath: string, relativePath: string): string {
  const trimmedRoot = vaultPath.endsWith('/') ? vaultPath.slice(0, -1) : vaultPath
  const trimmedRel = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath
  return `${trimmedRoot}/${trimmedRel}`
}

async function writeToClipboard(value: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || typeof navigator.clipboard?.writeText !== 'function') {
    return false
  }
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    return false
  }
}

export function useNoteContextMenu({ vaultPath, setToastMessage }: UseNoteContextMenuInput) {
  const [contextMenu, setContextMenu] = useState<NoteContextMenuState | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const closeContextMenu = useCallback(() => setContextMenu(null), [])

  useEffect(() => {
    if (!contextMenu) return

    const handleOutsideClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) closeContextMenu()
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeContextMenu()
    }

    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [closeContextMenu, contextMenu])

  const handleNoteContextMenu = useCallback((entry: VaultEntry, event: ReactMouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setContextMenu({ entry, x: event.clientX, y: event.clientY })
  }, [])

  const handleCopySystemPath = useCallback(async (entry: VaultEntry) => {
    closeContextMenu()
    if (!vaultPath) {
      setToastMessage(COPY_TOAST_NO_VAULT)
      return
    }
    const absolute = joinSystemPath(vaultPath, entry.path)
    const ok = await writeToClipboard(absolute)
    setToastMessage(ok ? COPY_TOAST_OK : COPY_TOAST_FAILED)
  }, [closeContextMenu, setToastMessage, vaultPath])

  const contextMenuNode = contextMenu ? (
    <div
      ref={menuRef}
      className="fixed z-50 rounded-md border bg-popover p-1 shadow-md"
      style={{ left: contextMenu.x, top: contextMenu.y, minWidth: 200 }}
      data-testid="note-context-menu"
    >
      <Button
        type="button"
        variant="ghost"
        className="h-auto w-full justify-start gap-2 px-2 py-1.5 text-sm"
        onClick={() => handleCopySystemPath(contextMenu.entry)}
        data-testid="copy-system-path-menu-item"
      >
        <Copy size={14} />
        Copy system path
      </Button>
    </div>
  ) : null

  return {
    closeContextMenu,
    contextMenuNode,
    handleNoteContextMenu,
  }
}
