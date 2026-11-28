import { describe, expect, it, vi } from 'vitest'
import { BlockNoteEditor } from '@blocknote/core'
import {
  createRichEditorPasteHandler,
  handleRichEditorPaste,
  type RichEditorPasteContext,
} from './richEditorPaste'
import { schema } from './editorSchema'

const importRemoteImagesToVault = vi.hoisted(() => vi.fn())
vi.mock('../lib/remoteAttachments', () => ({ importRemoteImagesToVault }))

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => `asset://localhost/${encodeURIComponent(path)}`,
}))

function clipboardDataFor(data: Record<string, string>): DataTransfer {
  return {
    getData: vi.fn((type: string) => data[type] ?? ''),
    types: Object.keys(data),
  } as unknown as DataTransfer
}

function pasteContext(data: Record<string, string>): RichEditorPasteContext {
  return {
    defaultPasteHandler: vi.fn(() => true),
    editor: { pasteMarkdown: vi.fn(), pasteText: vi.fn(() => true) },
    event: {
      clipboardData: clipboardDataFor(data),
    } as unknown as ClipboardEvent,
  }
}

const angleOpen = String.fromCharCode(60)
const angleClose = String.fromCharCode(62)
const cppInclude = `#include ${angleOpen}iostream${angleClose}`
const cppSource = `${cppInclude}\nint main() { return 0; }`
const fencedCppSource = ['```', cppSource, '```'].join('\n')
const longBoldText = `**${'Markdown source '.repeat(6).trim()}**`
const chatGptMarkdown = [
  '# ChatGPT Markdown',
  'Paragraph immediately follows the heading.',
  '',
  '- One list item',
  '',
  longBoldText,
].join('\n')

function htmlTag(name: string): string {
  return `${angleOpen}${name}${angleClose}`
}

function htmlCodeBlock(markup: string): string {
  return `${htmlTag('pre')}${htmlTag('code')}${markup}${htmlTag('/code')}${htmlTag('/pre')}`
}

describe('handleRichEditorPaste', () => {
  it('inserts a pasted bare URL as a link immediately when nothing is selected', () => {
    const insertInlineContent = vi.fn()
    const context = pasteContext({ 'text/plain': 'https://example.com/docs?a=1&b=2' })
    context.editor = {
      ...context.editor,
      getSelectedText: vi.fn(() => ''),
      insertInlineContent,
    }

    expect(handleRichEditorPaste(context)).toBe(true)
    expect(insertInlineContent).toHaveBeenCalledWith(
      [{ type: 'link', href: 'https://example.com/docs?a=1&b=2', content: 'https://example.com/docs?a=1&b=2' }],
      { updateSelection: true },
    )
    expect(context.defaultPasteHandler).not.toHaveBeenCalled()
  })

  it('leaves non-URL text and rich clipboards to the default paste when nothing is selected', () => {
    const insertInlineContent = vi.fn()
    const plain = pasteContext({ 'text/plain': 'see https://example.com' })
    const rich = pasteContext({
      'text/plain': 'https://example.com',
      [`text/${String.fromCharCode(104, 116, 109, 108)}`]: '<a href="https://example.com">x</a>',
    })
    for (const context of [plain, rich]) {
      context.editor = { ...context.editor, getSelectedText: vi.fn(() => ''), insertInlineContent }
      handleRichEditorPaste(context)
    }

    expect(insertInlineContent).not.toHaveBeenCalled()
  })

  it('turns a selected label into a link when a URL is pasted', () => {
    const createLink = vi.fn()
    const context = pasteContext({
      'text/plain': 'https://example.com/docs?section=editor&mode=rich',
    })
    context.editor = {
      createLink,
      getSelectedText: vi.fn(() => 'selected label'),
      pasteText: vi.fn(() => true),
    }

    expect(handleRichEditorPaste(context)).toBe(true)

    expect(createLink).toHaveBeenCalledWith('https://example.com/docs?section=editor&mode=rich')
    expect(context.defaultPasteHandler).not.toHaveBeenCalled()
    expect(context.editor.pasteText).not.toHaveBeenCalled()
  })

  it('keeps non-URL text and internal editor clips on their normal paste paths', () => {
    const nonUrlContext = pasteContext({ 'text/plain': 'plain clipboard text' })
    nonUrlContext.editor = {
      createLink: vi.fn(),
      getSelectedText: vi.fn(() => 'selected label'),
      pasteText: vi.fn(() => true),
    }
    const internalContext = pasteContext({
      'blocknote/html': '<p>https://example.com</p>',
      'text/plain': 'https://example.com',
    })
    internalContext.editor = {
      createLink: vi.fn(),
      getSelectedText: vi.fn(() => 'selected label'),
      pasteText: vi.fn(() => true),
    }

    expect(handleRichEditorPaste(nonUrlContext)).toBe(true)
    expect(handleRichEditorPaste(internalContext)).toBe(true)

    expect(nonUrlContext.defaultPasteHandler).toHaveBeenCalledOnce()
    expect(internalContext.defaultPasteHandler).toHaveBeenCalledOnce()
    expect(nonUrlContext.editor.createLink).not.toHaveBeenCalled()
    expect(internalContext.editor.createLink).not.toHaveBeenCalled()
  })

  it('prioritizes pasted web HTML when it contains images', () => {
    const context = pasteContext({
      'text/html': '<article><p>Intro</p><img src="https://example.com/photo.png" alt="Photo"></article>',
      'text/plain': 'Intro',
    })

    expect(handleRichEditorPaste(context)).toBe(true)

    expect(context.defaultPasteHandler).toHaveBeenCalledWith({ prioritizeMarkdownOverHTML: false })
    expect(context.editor.pasteText).not.toHaveBeenCalled()
  })

  it('prefers structured plain-text Markdown over a flattened rich fallback', () => {
    const context = pasteContext({
      'text/html': '<p>Flattened HTML fallback</p>',
      'text/plain': chatGptMarkdown,
    })

    expect(handleRichEditorPaste(context)).toBe(true)

    expect(context.editor.pasteMarkdown).toHaveBeenCalledWith(chatGptMarkdown)
    expect(context.defaultPasteHandler).not.toHaveBeenCalled()
    expect(context.editor.pasteText).not.toHaveBeenCalled()
  })

  it('keeps internal BlockNote image clips on the regular paste path', () => {
    const context = pasteContext({
      'blocknote/html': '<div data-content-type="image"></div>',
      'text/html': '<img src="asset://localhost/photo.png">',
      'text/plain': '![photo](attachments/photo.png)',
    })

    expect(handleRichEditorPaste(context)).toBe(true)

    expect(context.defaultPasteHandler).toHaveBeenCalledWith()
  })

  it('keeps explicit Markdown clips containing angle brackets on the regular paste path', () => {
    const context = pasteContext({
      'text/markdown': 'Use <kbd>Enter</kbd>',
      'text/plain': 'Use <kbd>Enter</kbd>',
    })

    expect(handleRichEditorPaste(context)).toBe(true)

    expect(context.defaultPasteHandler).toHaveBeenCalledWith()
    expect(context.editor.pasteText).not.toHaveBeenCalled()
  })

  it('preserves linked inline-code Markdown pasted as plain text', () => {
    const context = pasteContext({
      'text/plain': '[`some-symbol`](https://example.com)',
    })
    const editor = BlockNoteEditor.create({ schema })
    context.editor = editor as unknown as RichEditorPasteContext['editor']

    expect(handleRichEditorPaste(context)).toBe(true)

    expect(editor.document[0].content).toEqual([{
      content: [{ styles: { code: true }, text: 'some-symbol', type: 'text' }],
      href: 'https://example.com',
      type: 'link',
    }])
    expect(context.defaultPasteHandler).not.toHaveBeenCalled()
  })

  it.each([
    {
      name: 'fenced code Markdown with angle brackets',
      data: { 'text/plain': fencedCppSource },
    },
    {
      name: 'pasted HTML code blocks',
      data: {
        'text/html': htmlCodeBlock('#include &lt;iostream&gt;\nint main() { return 0; }'),
        'text/plain': cppSource,
      },
    },
  ])('converts $name before literal text handling', ({ data }) => {
    const context = pasteContext(data)

    expect(handleRichEditorPaste(context)).toBe(true)

    expect(context.editor.pasteMarkdown).toHaveBeenCalledWith(fencedCppSource)
    expect(context.defaultPasteHandler).not.toHaveBeenCalled()
    expect(context.editor.pasteText).not.toHaveBeenCalled()
  })

  it('does not parse untrusted HTML code without a plain-text clipboard source', () => {
    const context = pasteContext({
      'text/html': htmlCodeBlock('&lt;script&gt;window.compromised = true&lt;/script&gt;'),
    })

    expect(handleRichEditorPaste(context)).toBe(true)

    expect(context.defaultPasteHandler).toHaveBeenCalledWith()
    expect(context.editor.pasteMarkdown).not.toHaveBeenCalled()
    expect(context.editor.pasteText).not.toHaveBeenCalled()
  })

  it('replaces an empty paragraph with a canonicalized pasted code block', () => {
    const cursorBlock = { id: 'empty-paragraph', type: 'paragraph', content: [] }
    const context = pasteContext({
      'text/plain': '```ts\nconst answer: number = 42\n```',
    })
    context.editor = {
      getTextCursorPosition: vi.fn(() => ({ block: cursorBlock })),
      insertBlocks: vi.fn(),
      pasteMarkdown: vi.fn(),
      pasteText: vi.fn(() => true),
      replaceBlocks: vi.fn(),
    }

    expect(handleRichEditorPaste(context)).toBe(true)

    expect(context.editor.replaceBlocks).toHaveBeenCalledWith([cursorBlock], [{
      children: [],
      content: [{ styles: {}, text: 'const answer: number = 42', type: 'text' }],
      props: { language: 'typescript' },
      type: 'codeBlock',
    }])
    expect(context.editor.insertBlocks).not.toHaveBeenCalled()
    expect(context.editor.pasteMarkdown).not.toHaveBeenCalled()
    expect(context.editor.pasteText).not.toHaveBeenCalled()
  })

  it('pastes immediately, then rewrites imported image blocks to local assets', async () => {
    let completeImport: ((value: {
      failedCount: number
      replacements: Map<string, string>
      totalCount: number
    }) => void) | undefined
    const importImages = vi.fn(() => new Promise(resolve => { completeImport = resolve }))
    const updateBlock = vi.fn()
    const onImportResult = vi.fn()
    const context = pasteContext({
      'text/html': '<p>Intro</p><img src="https://example.com/photo.png" alt="Photo">',
      'text/plain': 'Intro',
    })
    const editor = {
      document: [{ id: 'image-1', type: 'image', props: { url: 'https://example.com/photo.png' } }],
      pasteText: vi.fn(() => true),
      updateBlock(blockId: string, update: { props: { url: string } }) {
        expect(this).toBe(editor)
        updateBlock(blockId, update)
      },
    }
    context.editor = editor
    const handler = createRichEditorPasteHandler({
      getVaultPath: () => '/vault',
      importImages,
      onImportResult,
    })

    expect(handler(context)).toBe(true)
    expect(context.defaultPasteHandler).toHaveBeenCalledTimes(1)
    expect(updateBlock).not.toHaveBeenCalled()

    completeImport?.({
      failedCount: 0,
      replacements: new Map([['https://example.com/photo.png', 'attachments/123-photo.png']]),
      totalCount: 1,
    })
    await Promise.resolve()
    await Promise.resolve()

    expect(updateBlock).toHaveBeenCalledWith(
      'image-1',
      { props: { url: 'asset://localhost/%2Fvault%2Fattachments%2F123-photo.png' } },
    )
    expect(onImportResult).toHaveBeenCalledWith({ failedCount: 0, totalCount: 1 })
  })

  it('leaves rich paste on the normal path when there is no active vault', () => {
    const importImages = vi.fn()
    const context = pasteContext({
      'text/html': '<img src="https://example.com/photo.png">',
      'text/plain': '',
    })
    const handler = createRichEditorPasteHandler({
      getVaultPath: () => undefined,
      importImages,
    })

    expect(handler(context)).toBe(true)
    expect(importImages).not.toHaveBeenCalled()
  })

  it('does not rewrite a different note when import finishes after navigation', async () => {
    const context = pasteContext({
      'text/html': '<img src="https://example.com/photo.png">',
    })
    context.editor = {
      document: [{ id: 'image-1', type: 'image', props: { url: 'https://example.com/photo.png' } }],
      pasteText: vi.fn(() => true),
      updateBlock: vi.fn(),
    }
    const handler = createRichEditorPasteHandler({
      canApply: () => false,
      getVaultPath: () => '/vault',
      importImages: vi.fn().mockResolvedValue({
        failedCount: 0,
        replacements: new Map([['https://example.com/photo.png', 'attachments/photo.png']]),
        totalCount: 1,
      }),
    })

    handler(context)
    await Promise.resolve()
    await Promise.resolve()

    expect(context.editor.updateBlock).not.toHaveBeenCalled()
  })
})

describe('rich paste of remote images on a Tolaria remote (TOL-204)', () => {
  const target = window as { TOLARIA_REMOTE_URL?: string; TOLARIA_REMOTE_TOKEN?: string }

  it('has the server import them and links their portable attachment paths', async () => {
    target.TOLARIA_REMOTE_URL = 'https://vault.example'
    target.TOLARIA_REMOTE_TOKEN = 'token-for-tests'
    importRemoteImagesToVault.mockResolvedValue({
      failedCount: 0,
      replacements: new Map([['https://example.com/photo.png', 'attachments/123-photo.png']]),
      totalCount: 1,
    })
    const desktopImport = vi.fn()
    const onImportResult = vi.fn()
    const context = pasteContext({ 'text/html': '<img src="https://example.com/photo.png">' })
    context.editor = {
      document: [{
        id: 'list-1',
        type: 'bulletListItem',
        children: [{ id: 'image-1', type: 'image', props: { url: 'https://example.com/photo.png' } }],
      }],
      pasteText: vi.fn(() => true),
      updateBlock: vi.fn(),
    }
    const handler = createRichEditorPasteHandler({
      getVaultPath: () => undefined,
      importImages: desktopImport,
      onImportResult,
    })

    try {
      handler(context)
      await vi.waitFor(() => expect(onImportResult).toHaveBeenCalledWith({ failedCount: 0, totalCount: 1 }))
    } finally {
      delete target.TOLARIA_REMOTE_URL
      delete target.TOLARIA_REMOTE_TOKEN
    }

    expect(importRemoteImagesToVault).toHaveBeenCalledWith([{ alt: '', url: 'https://example.com/photo.png' }])
    expect(desktopImport).not.toHaveBeenCalled()
    expect(context.editor.updateBlock).toHaveBeenCalledWith('image-1', { props: { url: 'attachments/123-photo.png' } })
  })
})
