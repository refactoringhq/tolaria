import type { ClipboardEvent } from 'react'
import type { useCreateBlockNote } from '@blocknote/react'
import { CellSelection } from '@tiptap/pm/tables'
import {
  richEditorClipboardPayload,
  selectedCodeBlockText,
  selectedEditorDomHtml,
  selectedEditorPlainText,
  selectedEditorRange,
  writeRichEditorClipboardPayload,
} from './editorRichCopy'

function handleCodeBlockCopy(event: ClipboardEvent<HTMLDivElement>): boolean {
  const codeText = selectedCodeBlockText({
    selection: window.getSelection(),
    container: event.currentTarget,
  })
  if (codeText === null) return false

  event.clipboardData.setData('text/plain', codeText)
  event.preventDefault()
  return true
}

function handleSelectedEditorCopy(
  event: ClipboardEvent<HTMLDivElement>,
  editor: ReturnType<typeof useCreateBlockNote>,
) {
  // A multi-cell range only maps to the head cell in the DOM selection, so the
  // DOM text below would copy one cell. BlockNote serializes the whole range.
  const selection = editor.prosemirrorState?.selection
  if (selection instanceof CellSelection && selection.$anchorCell.pos !== selection.$headCell.pos) return

  const domSelection = window.getSelection()
  const range = selectedEditorRange(domSelection, event.currentTarget)
  if (!domSelection || !range) return

  const plainText = selectedEditorPlainText(domSelection, range)
  if (plainText === null) return

  event.clipboardData.setData('text/plain', plainText)

  const richPayload = richEditorClipboardPayload(editor)
  if (richPayload) {
    writeRichEditorClipboardPayload(event.clipboardData, richPayload)
  } else {
    const markup = selectedEditorDomHtml(range)
    if (markup.length > 0) event.clipboardData.setData('text/html', markup)
  }

  event.preventDefault()
}

export function handleEditorCopy(
  event: ClipboardEvent<HTMLDivElement>,
  editor: ReturnType<typeof useCreateBlockNote>,
) {
  if (!handleCodeBlockCopy(event)) handleSelectedEditorCopy(event, editor)
}
