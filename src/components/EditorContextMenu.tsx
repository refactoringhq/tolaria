import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { ClipboardText, Copy, Files, Selection, type Icon } from '@phosphor-icons/react'
import type { useCreateBlockNote } from '@blocknote/react'
import { translate, type AppLocale } from '../lib/i18n'
import { trackEvent } from '../lib/telemetry'
import { requestPlainTextPaste } from '../utils/plainTextPaste'
import { getContextMenuPositionStyle } from './contextMenuPosition'
import { copyFullNoteToClipboard, pasteClipboardIntoEditor } from './editorFullNoteCopy'
import { Button } from './ui/button'

type ContextMenuEditor = ReturnType<typeof useCreateBlockNote>

interface EditorContextMenuItem {
  icon: Icon
  label: string
  onSelect: () => void
}

interface EditorContextMenuState {
  hasSelection: boolean
  x: number
  y: number
}

interface EditorContextMenuParams {
  containerRef: RefObject<HTMLDivElement | null>
  editable: boolean
  editor: ContextMenuEditor
  locale: AppLocale
}

function editorContextMenuItems(
  ctxMenu: EditorContextMenuState,
  editor: ContextMenuEditor,
  locale: AppLocale,
  close: () => void,
): EditorContextMenuItem[] {
  const runAction = (action: string, run: () => void) => {
    trackEvent('editor_context_menu_action', { action })
    close()
    run()
  }
  const copyFullNote = () => {
    void copyFullNoteToClipboard(editor).catch((error) => {
      console.warn('[editor] Copy full note failed:', error)
    })
  }
  const pasteFromClipboard = () => {
    void pasteClipboardIntoEditor(editor)
      .then((mode) => {
        trackEvent('editor_context_menu_paste', { mode: mode ?? 'plain_fallback' })
        if (mode === null) {
          return requestPlainTextPaste().catch((error) => {
            console.warn('[editor] Context menu paste fallback failed:', error)
          })
        }
        return undefined
      })
      .catch((error) => {
        console.warn('[editor] Context menu paste failed:', error)
      })
  }

  const items: EditorContextMenuItem[] = []
  if (ctxMenu.hasSelection) {
    items.push({
      icon: Copy,
      label: translate(locale, 'editor.contextMenu.copy'),
      onSelect: () => runAction('copy', () => { document.execCommand('copy') }),
    })
  }
  items.push(
    {
      icon: ClipboardText,
      label: translate(locale, 'editor.contextMenu.paste'),
      onSelect: () => runAction('paste', pasteFromClipboard),
    },
    {
      icon: Selection,
      label: translate(locale, 'editor.contextMenu.selectAll'),
      onSelect: () => runAction('select_all', () => {
        editor.focus()
        editor._tiptapEditor.commands.selectAll()
      }),
    },
    {
      icon: Files,
      label: translate(locale, 'editor.contextMenu.copyFullNote'),
      onSelect: () => runAction('copy_full_note', copyFullNote),
    },
  )
  return items
}

export function useEditorContextMenu({
  containerRef,
  editable,
  editor,
  locale,
}: EditorContextMenuParams) {
  const [ctxMenu, setCtxMenu] = useState<EditorContextMenuState | null>(null)
  const ctxMenuRef = useRef<HTMLDivElement | null>(null)

  const closeContextMenu = useCallback(() => {
    setCtxMenu(null)
  }, [])

  useEffect(() => {
    if (!ctxMenu) return

    const handleOutsideClick = (event: MouseEvent) => {
      if (ctxMenuRef.current && !ctxMenuRef.current.contains(event.target as Node)) closeContextMenu()
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
  }, [ctxMenu, closeContextMenu])

  const handleEditorContextMenu = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (!editable) return

    event.preventDefault()
    event.stopPropagation()

    const selection = window.getSelection()
    const hasSelection = Boolean(
      selection
      && selection.rangeCount > 0
      && !selection.isCollapsed
      && containerRef.current?.contains(selection.anchorNode),
    )
    trackEvent('editor_context_menu_opened', { has_selection: hasSelection ? 1 : 0 })
    setCtxMenu({ hasSelection, x: event.clientX, y: event.clientY })
  }, [containerRef, editable])

  const menuNode = ctxMenu
    ? createPortal(
      <div
        ref={ctxMenuRef}
        className="fixed z-[12000] rounded-md border bg-popover p-1 shadow-md"
        style={getContextMenuPositionStyle(ctxMenu, { minWidth: 200 })}
        data-testid="editor-context-menu"
      >
        {editorContextMenuItems(ctxMenu, editor, locale, closeContextMenu).map((item) => (
          <Button
            key={item.label}
            type="button"
            variant="ghost"
            className="flex h-auto w-full cursor-default items-center justify-start gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            onMouseDown={(event) => {
              // Keep the editor selection alive until the copy action runs.
              event.preventDefault()
            }}
            onClick={item.onSelect}
          >
            <item.icon size={16} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
          </Button>
        ))}
      </div>,
      document.body,
    )
    : null

  return { handleEditorContextMenu, menuNode }
}
