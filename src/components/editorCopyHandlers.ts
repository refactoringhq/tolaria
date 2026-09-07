import type { ClipboardEvent } from 'react'
import type { useCreateBlockNote } from '@blocknote/react'
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
  const selection = window.getSelection()
  const range = selectedEditorRange(selection, event.currentTarget)
  if (!selection || !range) return

  const plainText = selectedEditorPlainText(selection, range)
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
