import { createExtension } from '@blocknote/core'
import type { useCreateBlockNote } from '@blocknote/react'
import {
  consumeKeyboardEvent,
  createCaptureKeydownMount,
  isComposingKeyboardEvent,
  type RichEditorView,
} from './richEditorKeyboard'
import {
  collapsedSectionEndBlock,
  keepBlockVisibleOutsideCollapsedSection,
} from './tolariaCollapsedSections'

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
type CollapsedEnterEditor = EmptyListNavigationEditor & {
  document: BlockLike[]
  insertBlocks: (blocks: Array<{ type: 'paragraph' }>, referenceId: string, placement: 'after') => BlockLike[]
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

function isEmptyListItem(block: BlockLike | null | undefined): block is BlockLike {
  if (!block) return false
  return EMPTY_LIST_TYPES.has(block.type) && hasNoInlineContent(block)
}

function isAtVisualEdge(
  view: RichEditorView,
  direction: Navigation['direction'] | 'backward',
): boolean {
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

function isNestedUnderList(
  blocks: readonly BlockLike[],
  targetId: string,
  parentIsList = false,
): boolean {
  for (const block of blocks) {
    if (block.id === targetId) return parentIsList
    if (block.children && isNestedUnderList(block.children, targetId, EMPTY_LIST_TYPES.has(block.type))) return true
  }
  return false
}

function isNestedEmptyParagraphWithChildren(
  block: BlockLike,
  document: readonly BlockLike[],
): boolean {
  if (block.type !== 'paragraph' || !hasNoInlineContent(block)) return false
  if (!block.id || !block.children?.length) return false
  return isNestedUnderList(document, block.id)
}

function isPlainBackspaceAtBlockStart(
  event: ArrowEvent,
  editor: EmptyListNavigationEditor,
  view: RichEditorView,
): boolean {
  return event.key === 'Backspace'
    && !hasModifier(event)
    && editor.isEditable !== false
    && !isComposingKeyboardEvent(event, view)
    && isAtVisualEdge(view, 'backward')
}

function promoteNestedEmptyParagraph(
  event: ArrowEvent,
  editor: EmptyListNavigationEditor,
  view: RichEditorView,
): boolean {
  if (!isPlainBackspaceAtBlockStart(event, editor, view)) return false

  const { block } = editor.getTextCursorPosition()
  if (!isNestedEmptyParagraphWithChildren(block, editor.document)) return false

  const children = block.children ?? []
  const [firstChild] = children
  editor.replaceBlocks([block], children)
  editor.setTextCursorPosition(firstChild, 'start')
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

function isEligibleCollapsedEnter(event: ArrowEvent, editor: CollapsedEnterEditor, view: RichEditorView) {
  return event.key === 'Enter' && !hasModifier(event) && editor.isEditable !== false
    && !isComposingKeyboardEvent(event, view) && isAtTextblockEnd(view)
}

function isAtTextblockEnd(view: RichEditorView) {
  const { selection } = view.state
  return selection.empty && selection.$head.parentOffset === selection.$head.parent.content.size
}

function insertAfterCollapsedSection(event: ArrowEvent, editor: CollapsedEnterEditor, view: RichEditorView): boolean {
  if (!isEligibleCollapsedEnter(event, editor, view)) return false

  const { block } = editor.getTextCursorPosition()
  if (block.type !== 'heading' || !block.id) return false
  const sectionEnd = collapsedSectionEndBlock(editor as never, block.id)
  if (!sectionEnd?.id) return false

  const [paragraph] = editor.insertBlocks([{ type: 'paragraph' }], sectionEnd.id, 'after')
  if (!paragraph?.id) return false
  keepBlockVisibleOutsideCollapsedSection(editor as never, paragraph.id)
  editor.setTextCursorPosition(paragraph, 'start')
  consumeKeyboardEvent(event)
  return true
}

export const createRichEditorEmptyListNavigationExtension = createExtension(({ editor }) => {
  const richEditor = editor as EmptyListNavigationEditor
  const collapsedEnterEditor = editor as CollapsedEnterEditor

  return {
    key: 'richEditorEmptyListNavigation',
    mount: createCaptureKeydownMount(richEditor, (event, view) => {
      if (!view || promoteNestedEmptyParagraph(event, richEditor, view)) return
      if (insertAfterCollapsedSection(event, collapsedEnterEditor, view)) return
      handleArrowKey(event, richEditor, view)
    }),
  } as const
})
