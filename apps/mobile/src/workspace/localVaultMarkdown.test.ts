import { describe, expect, it } from 'vitest'
import {
  deriveLocalVaultTitle,
  localVaultEditorBlocks,
  localVaultEditorBullets,
  localVaultLinkCount,
  localVaultOutgoingLinks,
  localVaultSnippet,
} from './localVaultMarkdown'

const desktopMarkdownFixture = [
  '# Mobile Parity',
  '',
  '## Section',
  '#### Detail',
  '',
  '1. First step with [source](https://example.com)',
  '  1. Nested step',
  '',
  '- [x] Done ~~removed~~',
  '- [ ] Pending **bold**',
  '',
  '> Quote with **weight**',
  '> and a second line.',
  '',
  '```plain text',
  'const ok = true',
  '```',
  '',
  '---',
  '',
  'Paragraph with ***bold italic*** and [[Target Note|display text]].',
].join('\n')

const expectedDesktopBlocks = [
  { kind: 'heading', level: 2, text: 'Section' },
  { kind: 'heading', level: 4, text: 'Detail' },
  {
    kind: 'orderedList',
    items: [
      {
        content: [
          { text: 'First step with ' },
          { linkHref: 'https://example.com', text: 'source' },
        ],
        depth: 0,
        marker: '1.',
      },
      {
        content: [{ text: 'Nested step' }],
        depth: 1,
        marker: '1.',
      },
    ],
  },
  {
    kind: 'tasks',
    items: [
      { checked: true, content: [{ text: 'Done ' }, { strike: true, text: 'removed' }] },
      { checked: false, content: [{ text: 'Pending ' }, { bold: true, text: 'bold' }] },
    ],
  },
  {
    content: [{ text: 'Quote with ' }, { bold: true, text: 'weight' }, { text: ' and a second line.' }],
    kind: 'quote',
  },
  { code: 'const ok = true', kind: 'codeBlock', language: 'plain text' },
  { kind: 'divider' },
  {
    content: [
      { text: 'Paragraph with ' },
      { bold: true, italic: true, text: 'bold italic' },
      { text: ' and ' },
      { text: 'display text', wikilinkTarget: 'Target Note' },
      { text: '.' },
    ],
    kind: 'paragraph',
  },
]

describe('localVaultMarkdown', () => {
  it('parses desktop markdown blocks used by Tolaria notes', () => {
    const blocks = localVaultEditorBlocks(desktopMarkdownFixture)
    expect(blocks).toMatchObject(expectedDesktopBlocks)
    const taskItems = blocks.find((block) => block.kind === 'tasks')?.kind === 'tasks'
      ? blocks.find((block) => block.kind === 'tasks')?.items as Array<{ sourceLine?: number }>
      : []
    expect(taskItems.map((item) => item.sourceLine)).toEqual([8, 9])
  })

  it('derives mobile titles, snippets, and fallback bullet text from markdown', () => {
    const body = [
      '# Visible Title',
      '',
      '- First **item**',
      '  - Nested [[Target]]',
      '',
      'Paragraph with `code`.',
    ].join('\n')

    const blocks = localVaultEditorBlocks(body)

    expect(deriveLocalVaultTitle({ body, fallbackTitle: null, filename: 'fallback-title.md' })).toBe('Visible Title')
    expect(localVaultSnippet(body)).toBe('First item')
    expect(localVaultEditorBullets(blocks)).toEqual(['First item', 'Nested Target'])
  })

  it('does not render blank initial title placeholders as empty paragraphs', () => {
    expect(localVaultEditorBlocks(['# ', '', ''].join('\n'))).toEqual([])
  })

  it('extracts desktop body wikilink targets while ignoring fenced code', () => {
    const body = [
      'Body with [[Target Note|display]] and [[Folder/Other Note]].',
      '',
      '```md',
      'Ignored [[Code Link]].',
      '```',
      '',
      'Repeated [[Target Note]].',
    ].join('\n')

    expect(localVaultOutgoingLinks(body)).toEqual(['Folder/Other Note', 'Target Note'])
    expect(localVaultLinkCount(body)).toBe(2)
  })
})
