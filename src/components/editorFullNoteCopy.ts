import { cleanHTMLToMarkdown } from '@blocknote/core'
import type { useCreateBlockNote } from '@blocknote/react'
import { trackEvent } from '../lib/telemetry'
import { writeClipboardText } from '../utils/clipboardText'
import { htmlWithWikilinkLiterals, restoreWikilinkMarkdownFromMarkup } from './editorRichCopy'

type RichEditor = ReturnType<typeof useCreateBlockNote>

export type FullNoteClipboardPayload = {
  html: string
  markdown: string
}

export type FullNoteCopyMode = 'rich' | 'text'

type ClipboardRichWriter = (items: ClipboardItem[]) => Promise<void>

function richClipboardWriter(): ClipboardRichWriter | null {
  const clipboard = Reflect.get(navigator, 'clipboard') as
    | { write?: ClipboardRichWriter }
    | undefined
  if (!clipboard || typeof clipboard.write !== 'function') return null
  if (typeof ClipboardItem !== 'function') return null
  const write = clipboard.write
  return items => write(items)
}

export function fullNoteClipboardPayload(editor: RichEditor): FullNoteClipboardPayload | null {
  try {
    const blocks = editor.document
    if (!Array.isArray(blocks) || blocks.length === 0) return null

    const externalHtml = editor.blocksToHTMLLossy(blocks)
    const markdown = restoreWikilinkMarkdownFromMarkup(
      cleanHTMLToMarkdown(externalHtml),
      externalHtml,
      externalHtml,
    )
    if (markdown.trim().length === 0) return null

    return {
      html: htmlWithWikilinkLiterals(externalHtml),
      markdown,
    }
  } catch {
    return null
  }
}

export async function writeFullNoteClipboard(payload: FullNoteClipboardPayload): Promise<FullNoteCopyMode> {
  const writeRich = richClipboardWriter()
  if (writeRich) {
    try {
      await writeRich([
        new ClipboardItem({
          'text/html': payload.html,
          'text/plain': payload.markdown,
        }),
      ])
      return 'rich'
    } catch {
      // WebKit rejects clipboard writes without an active user gesture; fall
      // through to the text-only native bridge below.
    }
  }

  await writeClipboardText(payload.markdown)
  return 'text'
}

export async function copyFullNoteToClipboard(editor: RichEditor): Promise<boolean> {
  const payloadHtml = fullNoteClipboardPayload(editor)
  if (!payloadHtml) return false

  const mode = await writeFullNoteClipboard(payloadHtml)
  trackEvent('editor_copy_full_note', { mode })
  return true
}

export type EditorPasteMode = 'html' | 'text' | null

type PasteCapableEditor = {
  pasteHTML: (html: string, raw?: boolean) => unknown
  pasteText: (text: string) => unknown
}

type ClipboardItemReader = {
  types: readonly string[]
  getType: (type: string) => Promise<Blob>
}

type ClipboardReader = () => Promise<ClipboardItemReader[]>

function clipboardReader(): ClipboardReader | null {
  const clipboard = Reflect.get(navigator, 'clipboard') as
    | { read?: ClipboardReader }
    | undefined
  if (!clipboard || typeof clipboard.read !== 'function') return null
  return clipboard.read.bind(clipboard)
}

function findClipboardItem(items: ClipboardItemReader[], type: string): ClipboardItemReader | undefined {
  return items.find(item => item.types.includes(type))
}

async function clipboardItemText(item: ClipboardItemReader | undefined, type: string): Promise<string | undefined> {
  if (!item) return undefined
  return (await item.getType(type)).text()
}

async function readClipboardPayloadForPaste(): Promise<{ html?: string; text?: string } | null> {
  const read = clipboardReader()
  if (!read) return null

  try {
    const items = await read()
    const html = await clipboardItemText(findClipboardItem(items, 'text/html'), 'text/html')
    const text = await clipboardItemText(findClipboardItem(items, 'text/plain'), 'text/plain')
    return html || text ? { html, text } : null
  } catch {
    return null
  }
}

export async function pasteClipboardIntoEditor(editor: PasteCapableEditor): Promise<EditorPasteMode> {
  const payload = await readClipboardPayloadForPaste()
  if (payload?.html) {
    editor.pasteHTML(payload.html)
    return 'html'
  }
  if (payload?.text) {
    editor.pasteText(payload.text)
    return 'text'
  }
  return null
}
