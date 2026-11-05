import type { useCreateBlockNote } from '@blocknote/react'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { trackEvent } from '../lib/telemetry'
import { dispatchRichEditorExternalChange } from './editorExternalChangeEvents'
import {
  DEFAULT_MARKDOWN_HIGHLIGHT_COLOR,
  type MarkdownHighlightColor,
} from '../utils/markdownHighlightMarkdown'
import { selectionOrHighlightRange } from './markdownHighlightRange'
import { richEditorBlockSelectionPluginKey } from './richEditorBlockSelectionExtension'

export type HighlightEditor = ReturnType<typeof useCreateBlockNote>
export type HighlightRange = { from: number; to: number }

export type MarkdownHighlightRange = HighlightRange & {
  color: MarkdownHighlightColor
}

export type HighlightControlSource = 'cursor' | 'toolbar'

function isSelectedBlockNode(node: ProseMirrorNode, blockIds: readonly string[]): boolean {
  const id = node.attrs.id
  return node.type.isInGroup('bnBlock') && typeof id === 'string' && blockIds.includes(id)
}

function selectedBlockTextRange(editor: HighlightEditor, blockIds: readonly string[]): HighlightRange | null {
  const doc = editor.prosemirrorState.doc
  const positions = new Map<string, { pos: number; nodeSize: number }>()
  doc.descendants((node: ProseMirrorNode, pos: number) => {
    if (isSelectedBlockNode(node, blockIds)) {
      positions.set(node.attrs.id as string, { pos, nodeSize: node.nodeSize })
    }
    return true
  })
  const selectedPositions = [...positions.values()]
  if (selectedPositions.length === 0) return null

  const from = Math.min(...selectedPositions.map(({ pos }) => pos + 1), doc.content.size)
  const to = Math.max(
    from,
    Math.min(
      Math.max(...selectedPositions.map(({ pos, nodeSize }) => pos + nodeSize - 1)),
      doc.content.size,
    ),
  )
  return { from, to }
}

export function markdownHighlightSelectionRange(editor: HighlightEditor): HighlightRange | null {
  const blockSelection = richEditorBlockSelectionPluginKey.getState(editor.prosemirrorState)
  if (blockSelection) return selectedBlockTextRange(editor, blockSelection.blockIds)
  return selectionOrHighlightRange(editor)
}

function validRange(editor: HighlightEditor, range: HighlightRange | null): range is HighlightRange {
  if (!range) return false
  return range.from >= 0
    && range.to > range.from
    && range.to <= editor.prosemirrorState.doc.content.size
}

function updateHighlightMarks(
  editor: HighlightEditor,
  range: HighlightRange,
  color: MarkdownHighlightColor | null,
) {
  const { schema, tr } = editor.prosemirrorState
  const highlightMark = schema.marks.highlight
  const backgroundColorMark = schema.marks.backgroundColor
  if (!highlightMark || !backgroundColorMark) return

  let transaction = tr.removeMark(range.from, range.to, backgroundColorMark)
  if (color === null) {
    transaction = transaction.removeMark(range.from, range.to, highlightMark)
  } else {
    transaction = transaction.addMark(range.from, range.to, highlightMark.create())
    if (color !== DEFAULT_MARKDOWN_HIGHLIGHT_COLOR) {
      transaction = transaction.addMark(
        range.from,
        range.to,
        backgroundColorMark.create({ stringValue: color }),
      )
    }
  }

  editor.prosemirrorView.dispatch(transaction.scrollIntoView())
  dispatchRichEditorExternalChange(editor, editor.domElement ?? undefined)
  editor.focus()
}

export function applyMarkdownHighlightColor(
  editor: HighlightEditor,
  color: MarkdownHighlightColor,
  range: HighlightRange | null,
  source: HighlightControlSource,
) {
  if (!validRange(editor, range)) return

  updateHighlightMarks(editor, range, color)
  trackEvent('markdown_highlight_color_selected', { color, source })
}

export function toggleDefaultMarkdownHighlight(editor: HighlightEditor) {
  const range = markdownHighlightSelectionRange(editor)

  if (validRange(editor, range)) {
    const highlightMark = editor.prosemirrorState.schema.marks.highlight
    let hasText = false
    let allTextHighlighted = true
    editor.prosemirrorState.doc.nodesBetween(range.from, range.to, (node: ProseMirrorNode) => {
      if (!node.isText) return
      hasText = true
      allTextHighlighted &&= Boolean(highlightMark?.isInSet(node.marks))
    })
    if (!hasText) return

    updateHighlightMarks(
      editor,
      range,
      allTextHighlighted ? null : DEFAULT_MARKDOWN_HIGHLIGHT_COLOR,
    )
    return
  }

  editor.focus()
  editor.removeStyles({ backgroundColor: 'default' })
  editor.toggleStyles({ highlight: true })
}
