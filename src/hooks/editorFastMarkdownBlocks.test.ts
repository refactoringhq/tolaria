import { describe, expect, it } from 'vitest'
import {
  tryParseFastMarkdownBlocks,
  tryParseFastMarkdownBlocksOffThread,
} from './editorFastMarkdownBlocks'

function commonLongNoteMarkdown(): string {
  return [
    '# Project Alpha',
    '',
    'A paragraph with **bold**, *italic*, ~~strike~~, `code`, and [docs](https://example.com).',
    '',
    '- Parent',
    '  - Child',
    '- [x] Done',
    '1. First',
    '2. Second',
    '',
    '> Quote',
    '',
    '```ts',
    'const answer = 42',
    '```',
    '',
    '| Name | Status |',
    '| --- | --- |',
    '| Alpha | Ready |',
    '',
    '---',
  ].join('\n')
}

describe('tryParseFastMarkdownBlocks', () => {
  it('parses a heading followed by a long run of spaces in linear time', () => {
    const startedAt = performance.now()
    const result = tryParseFastMarkdownBlocks(`# Title${' '.repeat(3_000)}x`)

    expect(performance.now() - startedAt).toBeLessThan(500)
    expect(result.blocks?.[0]).toEqual(expect.objectContaining({ type: 'heading' }))
  })

  it('keeps closing hashes and trailing spaces out of heading text', () => {
    const result = tryParseFastMarkdownBlocks('## Title ##  ')

    expect(result.blocks?.[0]).toEqual(expect.objectContaining({
      type: 'heading',
      props: expect.objectContaining({ level: 2 }),
      content: [expect.objectContaining({ text: 'Title' })],
    }))
  })

  it('parses common long-note Markdown blocks directly', () => {
    const result = tryParseFastMarkdownBlocks(commonLongNoteMarkdown())

    expect(result.supported).toBe(true)
    expect(result.blocks).toEqual([
      expect.objectContaining({ type: 'heading', props: expect.objectContaining({ level: 1 }) }),
      expect.objectContaining({
        type: 'paragraph',
        content: expect.arrayContaining([
          expect.objectContaining({ styles: expect.objectContaining({ bold: true }), text: 'bold' }),
          expect.objectContaining({ styles: expect.objectContaining({ italic: true }), text: 'italic' }),
          expect.objectContaining({ styles: expect.objectContaining({ strike: true }), text: 'strike' }),
          expect.objectContaining({ styles: expect.objectContaining({ code: true }), text: 'code' }),
          expect.objectContaining({ type: 'link', href: 'https://example.com' }),
        ]),
      }),
      expect.objectContaining({
        type: 'bulletListItem',
        children: [expect.objectContaining({ type: 'bulletListItem' })],
      }),
      expect.objectContaining({ type: 'checkListItem', props: expect.objectContaining({ checked: true }) }),
      expect.objectContaining({ type: 'numberedListItem' }),
      expect.objectContaining({ type: 'numberedListItem', props: expect.objectContaining({ start: 2 }) }),
      expect.objectContaining({ type: 'quote' }),
      expect.objectContaining({ type: 'codeBlock', props: expect.objectContaining({ language: 'ts' }) }),
      expect.objectContaining({ type: 'table' }),
      expect.objectContaining({ type: 'divider' }),
    ])
  })

  it('parses standalone Markdown images into BlockNote-compatible blocks', () => {
    const result = tryParseFastMarkdownBlocks([
      '![diagram](attachments/diagram.png)',
      '',
      '![](attachments/empty-alt.png)',
    ].join('\n'))

    expect(result.supported).toBe(true)
    expect(result.blocks).toEqual([
      { type: 'image', props: { name: 'diagram', url: 'attachments/diagram.png' }, children: [] },
      { type: 'image', props: { name: '', url: 'attachments/empty-alt.png' }, children: [] },
    ])
  })

  it('rejects ambiguous Markdown constructs that need BlockNote parsing to preserve semantics', () => {
    const html = tryParseFastMarkdownBlocks('<aside>custom html</aside>')
    const referenceLink = tryParseFastMarkdownBlocks('[docs]: https://example.com')
    const inlineImage = tryParseFastMarkdownBlocks('Before ![diagram](attachments/diagram.png) after')

    expect(html.supported).toBe(false)
    expect(html.metrics.fallbackReason).toBe('html-block')
    expect(referenceLink.supported).toBe(false)
    expect(referenceLink.metrics.fallbackReason).toBe('reference-link')
    expect(inlineImage.supported).toBe(false)
    expect(inlineImage.metrics.fallbackReason).toBe('markdown-image')
  })

  it('emits BlockNote-compatible hrefs for external links in large-note blocks', () => {
    const result = tryParseFastMarkdownBlocks(
      '[Obsidian](https://obsidian.md/) and [Tolaria](https://tolaria.md/)',
    )
    const paragraph = result.blocks.at(0)

    expect(result.supported).toBe(true)
    expect(paragraph).toMatchObject({
      type: 'paragraph',
      content: [
        {
          type: 'link',
          href: 'https://obsidian.md/',
          content: [{ type: 'text', text: 'Obsidian', styles: {} }],
        },
        { type: 'text', text: ' and ', styles: {} },
        {
          type: 'link',
          href: 'https://tolaria.md/',
          content: [{ type: 'text', text: 'Tolaria', styles: {} }],
        },
      ],
    })
  })

  it('parses bare task-list markers as empty checklist blocks', () => {
    const markdown = [
      '> 工作项',
      '',
      '- [ ]',
      '',
      '> 非工作项',
      '',
      '- [x]',
    ].join('\n')

    const result = tryParseFastMarkdownBlocks(markdown)
    const checklistBlocks = result.blocks.filter(block => block.type === 'checkListItem')

    expect(result.supported).toBe(true)
    expect(checklistBlocks).toEqual([
      expect.objectContaining({ content: [], props: expect.objectContaining({ checked: false }) }),
      expect.objectContaining({ content: [], props: expect.objectContaining({ checked: true }) }),
    ])
  })

  it('uses the same parser result through the off-thread wrapper fallback in tests', async () => {
    const result = await tryParseFastMarkdownBlocksOffThread('# Title\n\nBody')

    expect(result.supported).toBe(true)
    expect(result.blocks).toEqual([
      expect.objectContaining({ type: 'heading' }),
      expect.objectContaining({ type: 'paragraph' }),
    ])
  })
})
