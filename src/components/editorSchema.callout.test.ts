import { BlockNoteEditor } from '@blocknote/core'
import { describe, expect, it } from 'vitest'
import { injectCalloutBlocks } from '../utils/calloutMarkdown'
import { serializeDurableEditorBlocks } from '../utils/editorDurableMarkdown'
import {
  injectRichEditorMarkdownBlocks,
  preProcessRichEditorMarkdown,
  serializeRichEditorBlocksToMarkdown,
} from '../utils/richEditorMarkdown'
import { schema } from './editorSchema'

async function roundTrip(markdown: string): Promise<string> {
  const editor = BlockNoteEditor.create({ schema })
  const parsed = await editor.tryParseMarkdownToBlocks(markdown)
  const injected = injectCalloutBlocks(parsed)
  editor.replaceBlocks(editor.document, injected as Parameters<typeof editor.replaceBlocks>[1])
  return serializeDurableEditorBlocks(editor, editor.document).trim()
}

describe('editor callout schema', () => {
  it('hydrates marker blockquotes as editable inline callouts', async () => {
    const editor = BlockNoteEditor.create({ schema })
    const parsed = await editor.tryParseMarkdownToBlocks([
      '> [!TIP] Read this',
      '> **bold** and [docs](https://example.com)',
    ].join('\n'))
    const [callout] = injectCalloutBlocks(parsed)

    expect(callout).toMatchObject({
      type: 'calloutBlock',
      props: { calloutType: 'tip', title: 'Read this' },
    })
    expect(JSON.stringify(callout)).toContain('bold')
    expect(JSON.stringify(callout)).toContain('https://example.com')
  })

  it('hydrates an untitled note callout for the localized fallback heading', async () => {
    const editor = BlockNoteEditor.create({ schema })
    const parsed = await editor.tryParseMarkdownToBlocks([
      '> [!note]',
      '> This untitled callout uses localized copy.',
    ].join('\n'))
    const [callout] = injectCalloutBlocks(parsed)

    expect(callout).toMatchObject({
      type: 'calloutBlock',
      props: { calloutType: 'note', title: '' },
    })
  })

  it('leaves collapsible callout variants as ordinary blockquotes', async () => {
    const markdown = [
      '> [!example]- Resources',
      '> **bold** and [docs](https://example.com)',
    ].join('\n')

    const editor = BlockNoteEditor.create({ schema })
    const parsed = await editor.tryParseMarkdownToBlocks(markdown)
    expect(injectCalloutBlocks(parsed).at(0)).toMatchObject({ type: 'quote' })
  })

  it('ignores legacy props that are absent from the current callout schema', async () => {
    const editor = BlockNoteEditor.create({ schema })
    const parsed = await editor.tryParseMarkdownToBlocks('> [!note] Legacy')
    const [callout] = injectCalloutBlocks(parsed)
    const legacyCallout = {
      ...callout,
      props: {
        ...callout.props,
        fold: '-',
      },
    }

    const serialized = serializeDurableEditorBlocks(
      editor,
      [legacyCallout] as Parameters<typeof serializeDurableEditorBlocks>[1],
    ).trim()
    expect(serialized).toBe('> [!note] Legacy')
  })

  it('round-trips multiline callout bodies without appending backslashes', async () => {
    const markdown = [
      '> [!note] Clean source',
      '> First line',
      '> Second line',
    ].join('\n')

    expect(await roundTrip(markdown)).toBe(markdown)
  })

  it('keeps callout body text clean through repeated rich/raw parsing', async () => {
    const markdown = [
      '> [!info] Details',
      '> Some text here',
      '> A second line',
    ].join('\n')
    const editor = BlockNoteEditor.create({ schema })
    const firstParse = await editor.tryParseMarkdownToBlocks(preProcessRichEditorMarkdown(markdown))
    const firstRich = injectRichEditorMarkdownBlocks(firstParse)
    editor.replaceBlocks(editor.document, firstRich as Parameters<typeof editor.replaceBlocks>[1])

    const raw = serializeRichEditorBlocksToMarkdown({ blocks: editor.document, editor })
    const secondParse = await editor.tryParseMarkdownToBlocks(preProcessRichEditorMarkdown(raw))
    const secondRich = injectRichEditorMarkdownBlocks(secondParse)
    editor.replaceBlocks(editor.document, secondRich as Parameters<typeof editor.replaceBlocks>[1])

    expect(serializeRichEditorBlocksToMarkdown({ blocks: editor.document, editor })).toBe(`${markdown}\n`)
    expect(JSON.stringify(editor.document)).not.toContain('> Some text here')
  })

  it('preserves leading quote characters in callout body content during hydration', () => {
    const hydrated = injectCalloutBlocks([{
      type: 'quote',
      content: [{ type: 'text', text: '[!info]\n> Some text here\n>> shift result' }],
    }])

    expect(hydrated[0]).toMatchObject({
      type: 'calloutBlock',
      content: [{ type: 'text', text: '> Some text here\n>> shift result' }],
    })
  })

  it('preserves an intentional nested quote marker in a callout body', () => {
    const editor = BlockNoteEditor.create({ schema })
    const markdown = '> [!info] Details\n> > This is an intentional nested quote.'
    const hydrated = injectCalloutBlocks([{
      type: 'quote',
      content: [{ type: 'text', text: '[!info] Details\n> This is an intentional nested quote.' }],
    }])
    editor.replaceBlocks(editor.document, hydrated as Parameters<typeof editor.replaceBlocks>[1])

    expect(hydrated[0]).toMatchObject({
      type: 'calloutBlock',
      content: [{ type: 'text', text: '> This is an intentional nested quote.' }],
    })
    expect(serializeDurableEditorBlocks(editor, editor.document).trim()).toBe(markdown)
  })

  it('leaves ordinary blockquotes unchanged', async () => {
    const editor = BlockNoteEditor.create({ schema })
    const parsed = await editor.tryParseMarkdownToBlocks('> ordinary quote')
    expect(injectCalloutBlocks(parsed).at(0)).toMatchObject({ type: 'quote' })
  })

  it('round-trips durable inline syntax inside callout bodies', async () => {
    const markdown = [
      '> [!note] Durable inline content',
      '> ==highlight==, $x+1$, and [[Target]]',
    ].join('\n')
    const editor = BlockNoteEditor.create({ schema })
    const preprocessed = preProcessRichEditorMarkdown(markdown)
    const parsed = await editor.tryParseMarkdownToBlocks(preprocessed)
    const injected = injectRichEditorMarkdownBlocks(parsed)
    editor.replaceBlocks(editor.document, injected as Parameters<typeof editor.replaceBlocks>[1])

    expect(serializeRichEditorBlocksToMarkdown({
      blocks: editor.document,
      editor,
    })).toBe(`${markdown}\n`)
  })
})
