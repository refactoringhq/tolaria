import { createExtension } from '@blocknote/core'
import type { useCreateBlockNote } from '@blocknote/react'
import {
  consumeKeyboardEvent,
  createCaptureKeydownMount,
  isComposingKeyboardEvent,
  type RichEditorView,
} from './richEditorKeyboard'

const EMPTY_LIST_TYPES = new Set([
  'bulletListItem',
  'checkListItem',
  'numberedListItem',
  'toggleListItem',
])

type EditorLike = ReturnType<typeof useCreateBlockNote>
type ArrowKey = 'ArrowDown' | 'ArrowUp'
type EmptyListNavigationEditor = EditorLike & { isEditable?: boolean }
type CursorPosition = ReturnType<EmptyListNavigationEditor['getTextCursorPosition']>
type BlockLike = {
  children?: BlockLike[]
  content?: unknown
  id?: string
  type: string
}
type Navigation = {
  adjacentBlock: (position: CursorPosition) => BlockLike | null | undefined
  direction: 'down' | 'up'
  placement: 'end' | 'start'
}
type ArrowEvent = Pick<
  KeyboardEvent,
  | 'altKey'
  | 'ctrlKey'
  | 'isComposing'
  | 'key'
  | 'keyCode'
  | 'metaKey'
  | 'preventDefault'
  | 'shiftKey'
  | 'stopImmediatePropagation'
>

const NAVIGATION_BY_KEY: Record<ArrowKey, Navigation> = {
  ArrowDown: {
    adjacentBlock: ({ nextBlock }) => nextBlock,
    direction: 'down',
    placement: 'start',
  },
  ArrowUp: {
    adjacentBlock: ({ prevBlock }) => prevBlock,
    direction: 'up',
    placement: 'end',
  },
}

function isArrowKey(key: string): key is ArrowKey {
  return Object.hasOwn(NAVIGATION_BY_KEY, key)
}

function hasModifier(event: ArrowEvent): boolean {
  return [event.altKey, event.ctrlKey, event.metaKey, event.shiftKey].some(Boolean)
}

function hasNoInlineContent(block: BlockLike): boolean {
  return Array.isArray(block.content) && block.content.length === 0
}

function hasChildren(block: BlockLike): boolean {
  return Array.isArray(block.children) && block.children.length > 0
}

function isEmptyListItem(block: BlockLike | null | undefined): block is BlockLike {
  if (!block) return false
  return EMPTY_LIST_TYPES.has(block.type) && hasNoInlineContent(block)
}

function isAtVisualEdge(view: RichEditorView, direction: Navigation['direction'] | 'backward'): boolean {
  if (!view.state.selection.empty) return false
  return view.endOfTextblock(direction)
}

function moveToAdjacentEmptyList(
  editor: EmptyListNavigationEditor,
  view: RichEditorView,
  navigation: Navigation,
): boolean {
  if (!isAtVisualEdge(view, navigation.direction)) return false

  const adjacentBlock = navigation.adjacentBlock(editor.getTextCursorPosition())
  if (!isEmptyListItem(adjacentBlock)) return false

  editor.setTextCursorPosition(adjacentBlock, navigation.placement)
  return true
}

function isNestedUnderList(blocks: BlockLike[], targetId: string, parentIsList = false): boolean {
  for (const block of blocks) {
    if (block.id === targetId) return parentIsList
    if (block.children && isNestedUnderList(block.children, targetId, EMPTY_LIST_TYPES.has(block.type))) return true
  }
  return false
}

function nestedEmptyParagraph(editor: EmptyListNavigationEditor): BlockLike | undefined {
  const { block } = editor.getTextCursorPosition()
  if (block.type !== 'paragraph' || !hasNoInlineContent(block) || !block.id) return undefined
  return isNestedUnderList(editor.document, block.id) ? block : undefined
}

function isPlainBackspace(
  event: ArrowEvent,
  editor: EmptyListNavigationEditor,
  view: RichEditorView,
): boolean {
  return event.key === 'Backspace'
    && editor.isEditable !== false
    && !isComposingKeyboardEvent(event, view)
}

function protectNestedEmptyParagraph(
  event: ArrowEvent,
  editor: EmptyListNavigationEditor,
  view: RichEditorView,
): boolean {
  if (!isPlainBackspace(event, editor, view) || !isAtVisualEdge(view, 'backward')) return false
  const block = nestedEmptyParagraph(editor)
  if (!block) return false

  if (!hasChildren(block)) editor.removeBlocks([block])
  consumeKeyboardEvent(event)
  return true
}

function shouldIgnoreArrow(
  event: ArrowEvent,
  editor: EmptyListNavigationEditor,
  view: RichEditorView,
): boolean {
  return [hasModifier(event), editor.isEditable === false, isComposingKeyboardEvent(event, view)].some(Boolean)
}

function handleArrowKey(
  event: ArrowEvent,
  editor: EmptyListNavigationEditor,
  view: RichEditorView,
): void {
  if (!isArrowKey(event.key) || shouldIgnoreArrow(event, editor, view)) return
  if (!moveToAdjacentEmptyList(editor, view, NAVIGATION_BY_KEY[event.key])) return

  consumeKeyboardEvent(event)
}

export const createRichEditorEmptyListNavigationExtension = createExtension(({ editor }) => {
  const richEditor = editor as EmptyListNavigationEditor

  return {
    key: 'richEditorEmptyListNavigation',
    mount: createCaptureKeydownMount(richEditor, (event, view) => {
      if (!view || protectNestedEmptyParagraph(event, richEditor, view)) return
      handleArrowKey(event, richEditor, view)
    }),
  } as const
})
