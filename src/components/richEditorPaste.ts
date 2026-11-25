import { trackEvent } from '../lib/telemetry'
import { injectLinkedCodeInBlocks, preProcessLinkedCodeMarkdown } from '../utils/linkedCodeMarkdown'
import { bareHttpUrl, pastedUrlLinkContent } from '../utils/pastedUrlLink'
import { clipboardRemoteImages, type RemoteImageImportResult } from '../utils/remoteImagePaste'
import { createTolariaCodeBlockOptions } from './codeBlockOptions'
import {
  type ImportRemoteImages,
  type RemoteImageImportTarget,
  remoteImageImportTarget,
} from './richPasteImageImport'

type PasteHandlerOptions = {
  plainTextAsMarkdown?: boolean
  prioritizeMarkdownOverHTML?: boolean
}

type PasteBlock = {
  children?: PasteBlock[]
  content?: unknown
  id?: string
  props?: Record<string, unknown>
  type?: string
}

type PasteBlockWithId = PasteBlock & { id: string }

type PasteTextContent = {
  styles: Record<string, never>
  text: string
  type: 'text'
}

type PasteCodeBlock = {
  language: string
  source: string
}

type PasteCodeBlockInsert = {
  children: []
  content: PasteTextContent[]
  props: { language: string }
  type: 'codeBlock'
}

type ClipboardMarkup = {
  value: string
}

type MarkupTagSearch = {
  fromIndex?: number
  normalizedMarkup: string
  tagName: string
}

type MarkupTagBoundary = {
  character: string
}

type RichPasteEditor = {
  createLink?: (url: string) => void
  document?: PasteBlock[]
  getSelectedText?: () => string
  getTextCursorPosition?: () => { block?: PasteBlock | null }
  insertInlineContent?: (content: never, options?: { updateSelection?: boolean }) => void
  insertBlocks?: (
    blocksToInsert: PasteCodeBlockInsert[],
    referenceBlock: string,
    placement?: 'before' | 'after'
  ) => unknown
  pasteMarkdown?: (markdown: string) => void
  pasteText: (text: string) => boolean | undefined
  replaceBlocks?: (blocksToRemove: PasteBlockWithId[], blocksToInsert: PasteCodeBlockInsert[]) => unknown
  tryParseMarkdownToBlocks?: (markdown: string) => PasteBlock[]
  updateBlock?: (blockId: string, update: { props: { url: string } }) => void
}

export type RichEditorPasteContext = {
  defaultPasteHandler: (options?: PasteHandlerOptions) => boolean | undefined
  editor: RichPasteEditor
  event: ClipboardEvent
}

const EXPLICIT_MARKDOWN_TYPES = new Set(['blocknote/html', 'text/markdown'])
const BLOCKNOTE_CLIPBOARD_TYPES = new Set(['blocknote/html'])
const WEB_MARKUP_MIME_TYPE = `text/${String.fromCharCode(104, 116, 109, 108)}`
const HTML_IMAGE_TAG_RE = /<img(?:\s|>|\/)/iu
const MARKDOWN_CODE_FENCE_OPEN_RE = /^\s*(`{3,}|~{3,})([^\r\n]*)$/u
const ANGLE_BRACKETED_TEXT_RE = /<[^<>\r\n]+>/u
const STANDALONE_CODE_FENCE_RE = /^\s*(?:`{3,}|~{3,})[^\r\n]*\r?\n[\s\S]*\r?\n\s*(?:`{3,}|~{3,})\s*$/u
const SPACED_LITERAL_ASTERISK_RE = /\S\s+\*\s+\S/u
const PREFIX_GLOB_ASTERISK_RE = /(?:^|\s)\*(?![*\s])[\w./-]+(?=\s|$)/u
const SUFFIX_GLOB_ASTERISK_RE = /(?:^|\s)[\w./-]+\*(?=\s|$)/u
const MARKDOWN_BLOCK_SIGNAL_RE = /^(?: {0,3}#{1,6}| {0,3}>| {0,3}(?:[-+*]|\d+[.)]))[ \t]+\S/mu
const MARKDOWN_REFERENCE_LINK_RE = /\[[^\]\n]+\]\[[^\]\n]+\]/u
const LONG_MARKDOWN_STRONG_RE = /(\*\*|__)(?!\s)[\s\S]{1,2000}?\S\1/u

type RichPasteHandlerOptions = {
  canApply?: () => boolean
  getVaultPath: () => string | undefined
  importImages?: ImportRemoteImages
  onImportResult?: (result: Pick<RemoteImageImportResult, 'failedCount' | 'totalCount'>) => void
}

type ActiveRichPasteHandlerOptions = Omit<RichPasteHandlerOptions, 'getVaultPath'> & {
  vaultPath?: string
}


function hasExplicitMarkdownPayload(clipboardData: DataTransfer): boolean {
  return Array.from(clipboardData.types).some(type => EXPLICIT_MARKDOWN_TYPES.has(type))
}

function hasBlockNoteClipboardPayload(clipboardData: DataTransfer): boolean {
  return Array.from(clipboardData.types).some(type => BLOCKNOTE_CLIPBOARD_TYPES.has(type))
}

function shouldPastePlainTextLiterally(text: string): boolean {
  if (STANDALONE_CODE_FENCE_RE.test(text)) return false

  return ANGLE_BRACKETED_TEXT_RE.test(text)
    || SPACED_LITERAL_ASTERISK_RE.test(text)
    || PREFIX_GLOB_ASTERISK_RE.test(text)
    || SUFFIX_GLOB_ASTERISK_RE.test(text)
}

function literalPlainText(clipboardData: DataTransfer | null): string | null {
  if (!clipboardData) return null

  const plainText = clipboardData.getData('text/plain')
  if (plainText.length === 0) return null
  if (hasExplicitMarkdownPayload(clipboardData)) return null
  if (!shouldPastePlainTextLiterally(plainText)) return null

  return plainText
}

function shouldPasteHTMLImagesFromHTML(clipboardData: DataTransfer | null): boolean {
  if (!clipboardData) return false
  if (hasBlockNoteClipboardPayload(clipboardData)) return false

  return HTML_IMAGE_TAG_RE.test(clipboardWebMarkup(clipboardData).value)
}

function structuredPlainTextMarkdown(clipboardData: DataTransfer | null): string | null {
  if (!clipboardData || hasBlockNoteClipboardPayload(clipboardData)) return null
  if (!clipboardWebMarkup(clipboardData).value) return null

  const plainText = clipboardData.getData('text/plain')
  return MARKDOWN_BLOCK_SIGNAL_RE.test(plainText)
    || MARKDOWN_REFERENCE_LINK_RE.test(plainText)
    || LONG_MARKDOWN_STRONG_RE.test(plainText)
    ? plainText
    : null
}

function clipboardWebMarkup(clipboardData: DataTransfer): ClipboardMarkup {
  return { value: clipboardData.getData(WEB_MARKUP_MIME_TYPE) }
}

function isMarkupTagBoundary({ character }: MarkupTagBoundary): boolean {
  return character === '' || character === '>' || character === '/' || character.charCodeAt(0) <= 32
}

function markupTagStartIndex({
  fromIndex = 0,
  normalizedMarkup,
  tagName,
}: MarkupTagSearch): number {
  const needle = `<${tagName}`
  let searchIndex = fromIndex

  while (searchIndex < normalizedMarkup.length) {
    const tagIndex = normalizedMarkup.indexOf(needle, searchIndex)
    if (tagIndex === -1) return -1

    const boundary = normalizedMarkup.charAt(tagIndex + needle.length)
    if (isMarkupTagBoundary({ character: boundary })) return tagIndex

    searchIndex = tagIndex + needle.length
  }

  return -1
}

function hasPreCodeMarkup(markup: ClipboardMarkup): boolean {
  const normalizedMarkup = markup.value.toLowerCase()
  const preStart = markupTagStartIndex({ normalizedMarkup, tagName: 'pre' })
  if (preStart === -1) return false

  const preEnd = markupTagStartIndex({ fromIndex: preStart + 4, normalizedMarkup, tagName: '/pre' })
  const codeStart = markupTagStartIndex({ fromIndex: preStart + 4, normalizedMarkup, tagName: 'code' })
  if (codeStart === -1) return false

  return preEnd === -1 || codeStart < preEnd
}

function shouldPasteHTMLCodeBlocksFromHTML(clipboardData: DataTransfer | null): boolean {
  if (!clipboardData) return false
  if (hasExplicitMarkdownPayload(clipboardData)) return false

  return hasPreCodeMarkup(clipboardWebMarkup(clipboardData))
}

function normalizedCodeBlockLanguageToken(language: string): string {
  const normalized = language.trim().split(/\s+/u)[0]?.toLowerCase() ?? ''
  return /^[a-z0-9][a-z0-9#+._-]*$/u.test(normalized) ? normalized : ''
}

function resolveCodeBlockLanguage(language: string): string {
  const normalized = normalizedCodeBlockLanguageToken(language)
  if (!normalized) return ''

  const supportedLanguages = createTolariaCodeBlockOptions().supportedLanguages ?? {}
  return Object.entries(supportedLanguages)
    .find(([id, option]) => id === normalized || option.aliases?.includes(normalized))
    ?.[0] ?? normalized
}

function codeFenceForSource(source: string): string {
  return source.includes('```') ? '~~~' : '```'
}

function markdownCodeBlockFromPasteBlock(block: PasteCodeBlock): string {
  const source = block.source.replace(/\n$/u, '')
  const fence = codeFenceForSource(source)
  return `${fence}${block.language}\n${source}\n${fence}`
}

function htmlCodeBlocks(clipboardData: DataTransfer | null): PasteCodeBlock[] {
  if (!shouldPasteHTMLCodeBlocksFromHTML(clipboardData)) return []
  const source = clipboardData?.getData('text/plain') ?? ''
  if (!source) return []

  return [{ language: '', source }]
}

function clipboardMarkdownSource(clipboardData: DataTransfer | null): string {
  if (!clipboardData) return ''
  if (hasBlockNoteClipboardPayload(clipboardData)) return ''

  return clipboardData.getData('text/markdown') || clipboardData.getData('text/plain')
}

function standaloneCodeFenceLines(markdown: string): string[] | null {
  return STANDALONE_CODE_FENCE_RE.test(markdown)
    ? markdown.trim().split(/\r?\n/u)
    : null
}

function openingCodeFence(line: string): { language: string; marker: string } | null {
  const opening = MARKDOWN_CODE_FENCE_OPEN_RE.exec(line)
  if (!opening) return null
  return {
    language: resolveCodeBlockLanguage(opening[2] ?? ''),
    marker: opening[1],
  }
}

function closesCodeFence(lines: string[], marker: string): boolean {
  const closing = lines.at(-1)?.trim() ?? ''
  return closing.startsWith(marker.charAt(0).repeat(marker.length))
}

function markdownCodeBlocks(clipboardData: DataTransfer | null): PasteCodeBlock[] {
  const lines = standaloneCodeFenceLines(clipboardMarkdownSource(clipboardData))
  if (!lines || lines.length < 2) return []

  const opening = openingCodeFence(lines[0] ?? '')
  if (!opening || !closesCodeFence(lines, opening.marker)) return []

  return [{
    language: opening.language,
    source: lines.slice(1, -1).join('\n'),
  }]
}

function codeBlockInsert(block: PasteCodeBlock): PasteCodeBlockInsert {
  return {
    children: [],
    content: [{
      styles: {},
      text: block.source.replace(/\n$/u, ''),
      type: 'text',
    }],
    props: { language: block.language || 'text' },
    type: 'codeBlock',
  }
}

function blockText(block: PasteBlock): string {
  const content = block.content
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''

  return content.map(item => (
    typeof item === 'object'
      && item !== null
      && 'text' in item
      && typeof item.text === 'string'
      ? item.text
      : ''
  )).join('')
}

function isEmptyParagraph(block: PasteBlock): boolean {
  return block.type === 'paragraph' && blockText(block).trim() === ''
}

function blockWithId(block: PasteBlock | null | undefined): PasteBlockWithId | null {
  return typeof block?.id === 'string' ? { ...block, id: block.id } : null
}

function insertCodeBlocks(editor: RichPasteEditor, blocks: PasteCodeBlock[]): boolean {
  if (blocks.length === 0 || !editor.insertBlocks || !editor.getTextCursorPosition) return false

  const cursorBlock = blockWithId(editor.getTextCursorPosition().block)
  if (!cursorBlock) return false

  const inserts = blocks.map(codeBlockInsert)
  if (editor.replaceBlocks && isEmptyParagraph(cursorBlock)) {
    editor.replaceBlocks([cursorBlock], inserts)
    return true
  }

  editor.insertBlocks(inserts, cursorBlock.id, 'after')
  return true
}

function codeBlocksAsMarkdown(blocks: PasteCodeBlock[]): string {
  return blocks.map(markdownCodeBlockFromPasteBlock).join('\n\n')
}

function pasteCodeBlocks(editor: RichPasteEditor, clipboardData: DataTransfer | null): boolean {
  const codeBlocks = [...htmlCodeBlocks(clipboardData), ...markdownCodeBlocks(clipboardData)]
  if (insertCodeBlocks(editor, codeBlocks)) return true

  const markdown = codeBlocksAsMarkdown(codeBlocks)
  if (!markdown || !editor.pasteMarkdown) return false

  editor.pasteMarkdown(markdown)
  return true
}

function linkedCodeMarkdownSource(clipboardData: DataTransfer | null): string | null {
  if (!clipboardData || hasBlockNoteClipboardPayload(clipboardData)) return null
  if (!hasExplicitMarkdownPayload(clipboardData) && clipboardWebMarkup(clipboardData).value) return null

  const markdown = clipboardMarkdownSource(clipboardData)
  const protectedMarkdown = preProcessLinkedCodeMarkdown(markdown)
  if (!markdown || protectedMarkdown === markdown) return null
  return protectedMarkdown
}

function singleParagraphInlineContent(blocks: PasteBlock[]): unknown[] | null {
  if (blocks.length !== 1) return null

  const [block] = blocks
  if (block.type !== 'paragraph' || block.children?.length) return null
  return Array.isArray(block.content) ? block.content : null
}

function linkedCodeInlineContent(
  clipboardData: DataTransfer | null,
  editor: RichPasteEditor,
): unknown[] | null {
  if (!editor.tryParseMarkdownToBlocks) return null
  const markdown = linkedCodeMarkdownSource(clipboardData)
  if (!markdown) return null

  const parsedBlocks = editor.tryParseMarkdownToBlocks(markdown)
  const injectedBlocks = injectLinkedCodeInBlocks(parsedBlocks) as PasteBlock[]
  return injectedBlocks === parsedBlocks ? null : singleParagraphInlineContent(injectedBlocks)
}

function insertLinkedCodeMarkdown(
  editor: RichPasteEditor,
  clipboardData: DataTransfer | null,
): boolean {
  if (!editor.insertInlineContent) return false
  const content = linkedCodeInlineContent(clipboardData, editor)
  if (!content) return false

  const insertInlineContent = editor.insertInlineContent as unknown as (
    content: unknown[],
    options?: { updateSelection?: boolean },
  ) => void
  insertInlineContent.call(editor, content, { updateSelection: true })
  return true
}

function plainHttpLinkUrl(clipboardData: DataTransfer): string | null {
  if (hasExplicitMarkdownPayload(clipboardData) || clipboardWebMarkup(clipboardData).value) return null

  return bareHttpUrl({ text: clipboardData.getData('text/plain') })
}

function editorHasSelectedText(editor: RichPasteEditor): boolean {
  return typeof editor.getSelectedText === 'function' && editor.getSelectedText().length > 0
}

function selectedTextLinkUrl(
  clipboardData: DataTransfer | null,
  editor: RichPasteEditor,
): string | null {
  if (!clipboardData || !editor.createLink || !editorHasSelectedText(editor)) return null
  return plainHttpLinkUrl(clipboardData)
}

function linkSelectedTextFromPaste(
  clipboardData: DataTransfer | null,
  editor: RichPasteEditor,
): boolean {
  const url = selectedTextLinkUrl(clipboardData, editor)
  if (!url) return false

  editor.createLink?.(url)
  return true
}

function insertPastedUrlAsLink(
  clipboardData: DataTransfer | null,
  editor: RichPasteEditor,
): boolean {
  if (!clipboardData || !editor.insertInlineContent || editorHasSelectedText(editor)) return false
  if (editor.getTextCursorPosition?.().block?.type === 'codeBlock') return false

  const url = plainHttpLinkUrl(clipboardData)
  if (!url) return false

  const insertInlineContent = editor.insertInlineContent as unknown as (
    content: unknown[],
    options?: { updateSelection?: boolean },
  ) => void
  insertInlineContent.call(editor, pastedUrlLinkContent(url), { updateSelection: true })
  return true
}

export function handleRichEditorPaste({
  defaultPasteHandler,
  editor,
  event,
}: RichEditorPasteContext): boolean | undefined {
  if (linkSelectedTextFromPaste(event.clipboardData, editor)) return true
  if (insertPastedUrlAsLink(event.clipboardData, editor)) return true
  if (pasteCodeBlocks(editor, event.clipboardData)) return true

  if (insertLinkedCodeMarkdown(editor, event.clipboardData)) return true

  if (shouldPasteHTMLImagesFromHTML(event.clipboardData)) {
    return defaultPasteHandler({ prioritizeMarkdownOverHTML: false })
  }

  const structuredMarkdown = structuredPlainTextMarkdown(event.clipboardData)
  if (structuredMarkdown && editor.pasteMarkdown) {
    editor.pasteMarkdown(structuredMarkdown)
    return true
  }

  const plainText = literalPlainText(event.clipboardData)
  if (plainText) return editor.pasteText(plainText)

  return defaultPasteHandler()
}

function replaceRichImageBlockUrls(
  blocks: PasteBlock[],
  replacements: ReadonlyMap<string, string>,
  updateBlock: NonNullable<RichPasteEditor['updateBlock']>,
  attachmentUrl: RemoteImageImportTarget['attachmentUrl'],
): void {
  for (const block of blocks) {
    const url = block.type === 'image' ? block.props?.url : undefined
    if (typeof url === 'string' && typeof block.id === 'string') {
      const attachmentPath = replacements.get(url)
      if (attachmentPath) {
        updateBlock(block.id, { props: { url: attachmentUrl(attachmentPath) } })
      }
    }
    if (block.children) {
      replaceRichImageBlockUrls(block.children, replacements, updateBlock, attachmentUrl)
    }
  }
}

function finishRichRemoteImageImport(
  context: RichEditorPasteContext,
  options: ActiveRichPasteHandlerOptions,
  result: RemoteImageImportResult,
  attachmentUrl: RemoteImageImportTarget['attachmentUrl'],
): void {
  const target = richImageRewriteTarget(context, options)
  if (target) {
    replaceRichImageBlockUrls(
      target.blocks,
      result.replacements,
      target.updateBlock,
      attachmentUrl,
    )
  }
  options.onImportResult?.({
    failedCount: result.failedCount,
    totalCount: result.totalCount,
  })
  trackEvent('remote_images_paste_imported', {
    surface: 'rich_editor',
    total_count: result.totalCount,
    success_count: result.totalCount - result.failedCount,
    failure_count: result.failedCount,
  })
}

function richImageRewriteTarget(
  context: RichEditorPasteContext,
  options: ActiveRichPasteHandlerOptions,
): { blocks: PasteBlock[]; updateBlock: NonNullable<RichPasteEditor['updateBlock']> } | null {
  if (options.canApply?.() === false) return null
  const blocks = context.editor.document
  const updateBlock = context.editor.updateBlock?.bind(context.editor)
  if (!blocks || !updateBlock) return null
  return { blocks, updateBlock }
}

export function createRichEditorPasteHandler(
  options: RichPasteHandlerOptions,
): (context: RichEditorPasteContext) => boolean | undefined {
  return context => handleRemoteRichEditorPaste(context, {
    canApply: options.canApply,
    importImages: options.importImages,
    onImportResult: options.onImportResult,
    vaultPath: options.getVaultPath(),
  })
}

export function handleRemoteRichEditorPaste(
  context: RichEditorPasteContext,
  options: ActiveRichPasteHandlerOptions,
): boolean | undefined {
  const images = context.event.clipboardData
    ? clipboardRemoteImages(context.event.clipboardData)
    : []
  const handled = handleRichEditorPaste(context)
  const target = remoteImageImportTarget(options)
  if (images.length === 0 || !target) return handled

  void target.importImages(images).then(result => {
    finishRichRemoteImageImport(context, options, result, target.attachmentUrl)
  })
  return handled
}

