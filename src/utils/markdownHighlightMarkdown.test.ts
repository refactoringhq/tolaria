import { describe, expect, it, vi } from 'vitest'
import {
  injectMarkdownHighlightsInBlocks,
  MARKDOWN_HIGHLIGHT_COLOR_OPTIONS,
  MARKDOWN_HIGHLIGHT_STYLE,
  restoreMarkdownHighlightsInBlocks,
  serializeMarkdownHighlightAwareBlocks,
} from './markdownHighlightMarkdown'

describe('markdown highlight color metadata', () => {
  it('keeps color ids, markdown prefixes, and locale keys together', () => {
    expect(MARKDOWN_HIGHLIGHT_COLOR_OPTIONS).toEqual([
      {
        color: 'yellow',
        localeKey: 'editor.formatting.highlightYellow',
        markdownPrefix: '',
      },
      {
        color: 'green',
        localeKey: 'editor.formatting.highlightGreen',
        markdownPrefix: '🟢',
      },
      {
        color: 'red',
        localeKey: 'editor.formatting.highlightRed',
        markdownPrefix: '🔴',
      },
      {
        color: 'blue',
        localeKey: 'editor.formatting.highlightBlue',
        markdownPrefix: '🔵',
      },
      {
        color: 'purple',
        localeKey: 'editor.formatting.highlightPurple',
        markdownPrefix: '🟣',
      },
    ])
  })
})

describe('markdown highlight round-trip', () => {
  it('marks ==highlight== spans in parsed rich-editor inline content', () => {
    const blocks = injectMarkdownHighlightsInBlocks([{
      type: 'paragraph',
      content: [{ type: 'text', text: 'Keep ==important== visible.', styles: {} }],
      children: [],
    }])

    expect(blocks).toEqual([{
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Keep ', styles: {} },
        { type: 'text', text: 'important', styles: { [MARKDOWN_HIGHLIGHT_STYLE]: true } },
        { type: 'text', text: ' visible.', styles: {} },
      ],
      children: [],
    }])
  })

  it('preserves existing inline styles inside ==highlight== markers', () => {
    const blocks = injectMarkdownHighlightsInBlocks([{
      type: 'paragraph',
      content: [
        { type: 'text', text: 'A ==', styles: {} },
        { type: 'text', text: 'bold', styles: { bold: true } },
        { type: 'text', text: '== note', styles: {} },
      ],
      children: [],
    }])

    expect(blocks).toEqual([{
      type: 'paragraph',
      content: [
        { type: 'text', text: 'A ', styles: {} },
        { type: 'text', text: 'bold', styles: { bold: true, [MARKDOWN_HIGHLIGHT_STYLE]: true } },
        { type: 'text', text: ' note', styles: {} },
      ],
      children: [],
    }])
  })

  it('maps Bear-style circle prefixes to durable highlight colors', () => {
    const blocks = injectMarkdownHighlightsInBlocks([{
      type: 'paragraph',
      content: [{
        type: 'text',
        text: '==🔴red== ==🔵blue== ==🟣purple== ==🟢green== ==yellow==',
        styles: {},
      }],
      children: [],
    }])

    expect(blocks).toEqual([{
      type: 'paragraph',
      content: [
        { type: 'text', text: 'red', styles: { highlight: true, backgroundColor: 'red' } },
        { type: 'text', text: ' ', styles: {} },
        { type: 'text', text: 'blue', styles: { highlight: true, backgroundColor: 'blue' } },
        { type: 'text', text: ' ', styles: {} },
        { type: 'text', text: 'purple', styles: { highlight: true, backgroundColor: 'purple' } },
        { type: 'text', text: ' ', styles: {} },
        { type: 'text', text: 'green', styles: { highlight: true, backgroundColor: 'green' } },
        { type: 'text', text: ' ', styles: {} },
        { type: 'text', text: 'yellow', styles: { highlight: true } },
      ],
      children: [],
    }])
  })

  it('keeps ==🟢green== circle prefixes out of the highlighted text', () => {
    const blocks = injectMarkdownHighlightsInBlocks([{
      type: 'paragraph',
      content: [{ type: 'text', text: '==🟢green==', styles: {} }],
      children: [],
    }])

    expect(blocks).toEqual([{
      type: 'paragraph',
      content: [{ type: 'text', text: 'green', styles: { highlight: true, backgroundColor: 'green' } }],
      children: [],
    }])
  })

  it('keeps a circle-only highlight visible instead of eating its emoji', () => {
    const blocks = injectMarkdownHighlightsInBlocks([{
      type: 'paragraph',
      content: [{ type: 'text', text: '作者==🟢== 的原话：「Adobe==🔴== Photoshop 太贵」', styles: {} }],
      children: [],
    }])

    expect(blocks).toEqual([{
      type: 'paragraph',
      content: [
        { type: 'text', text: '作者', styles: {} },
        { type: 'text', text: '🟢', styles: { highlight: true, backgroundColor: 'green' } },
        { type: 'text', text: ' 的原话：「Adobe', styles: {} },
        { type: 'text', text: '🔴', styles: { highlight: true, backgroundColor: 'red' } },
        { type: 'text', text: ' Photoshop 太贵」', styles: {} },
      ],
      children: [],
    }])
  })

  it('still reads a circle prefix that is followed by more highlighted content', () => {
    const blocks = injectMarkdownHighlightsInBlocks([{
      type: 'paragraph',
      content: [
        { type: 'text', text: '==🟢', styles: {} },
        { type: 'text', text: 'bold', styles: { bold: true } },
        { type: 'text', text: '== rest', styles: {} },
      ],
      children: [],
    }])

    expect(blocks).toEqual([{
      type: 'paragraph',
      content: [
        { type: 'text', text: 'bold', styles: { bold: true, highlight: true, backgroundColor: 'green' } },
        { type: 'text', text: ' rest', styles: {} },
      ],
      children: [],
    }])
  })

  it('leaves code-styled ==text== literal', () => {
    const blocks = injectMarkdownHighlightsInBlocks([{
      type: 'paragraph',
      content: [{ type: 'text', text: '==literal==', styles: { code: true } }],
      children: [],
    }])

    expect(blocks).toEqual([{
      type: 'paragraph',
      content: [{ type: 'text', text: '==literal==', styles: { code: true } }],
      children: [],
    }])
  })

  it('leaves fenced code block equality operators literal', () => {
    const blocks = injectMarkdownHighlightsInBlocks([{
      type: 'codeBlock',
      content: [{ type: 'text', text: 'if a == "1" and b == "2":', styles: {} }],
      children: [],
    }])

    expect(blocks).toEqual([{
      type: 'codeBlock',
      content: [{ type: 'text', text: 'if a == "1" and b == "2":', styles: {} }],
      children: [],
    }])
  })

  it('serializes highlighted inline content back to ==markdown== source', () => {
    const editor = {
      blocksToMarkdownLossy: vi.fn((blocks: unknown[]) => {
        return (blocks as Array<{ content?: Array<{ text?: string }> }>)
          .map((block) => block.content?.map((item) => item.text ?? '').join('') ?? '')
          .join('\n\n')
      }),
    }
    const blocks = [{
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Keep ', styles: {} },
        { type: 'text', text: 'important', styles: { [MARKDOWN_HIGHLIGHT_STYLE]: true } },
        { type: 'text', text: ' visible.', styles: {} },
      ],
      children: [],
    }]

    expect(serializeMarkdownHighlightAwareBlocks(editor, blocks)).toBe('Keep ==important== visible.')
    expect(editor.blocksToMarkdownLossy).toHaveBeenCalledWith(restoreMarkdownHighlightsInBlocks(blocks))
  })

  it('serializes adjacent highlight colors with their circle prefixes', () => {
    const editor = {
      blocksToMarkdownLossy: vi.fn((blocks: unknown[]) => {
        return (blocks as Array<{ content?: Array<{ text?: string }> }>)
          .map((block) => block.content?.map((item) => item.text ?? '').join('') ?? '')
          .join('\n\n')
      }),
    }
    const blocks = [{
      type: 'paragraph',
      content: [
        { type: 'text', text: 'red', styles: { highlight: true, backgroundColor: 'red' } },
        { type: 'text', text: 'blue', styles: { highlight: true, backgroundColor: 'blue' } },
        { type: 'text', text: 'yellow', styles: { highlight: true } },
      ],
      children: [],
    }]

    expect(serializeMarkdownHighlightAwareBlocks(editor, blocks)).toBe(
      '==🔴red====🔵blue====yellow==',
    )
  })

  it('round-trips a circle-only highlight back to its original bytes', () => {
    const editor = {
      blocksToMarkdownLossy: vi.fn((blocks: unknown[]) => {
        return (blocks as Array<{ content?: Array<{ text?: string }> }>)
          .map((block) => block.content?.map((item) => item.text ?? '').join('') ?? '')
          .join('\n\n')
      }),
    }
    const markdown = '作者==🟢== 的原话：「Adobe==🔴== Photoshop 太贵」'
    const injected = injectMarkdownHighlightsInBlocks([{
      type: 'paragraph',
      content: [{ type: 'text', text: markdown, styles: {} }],
      children: [],
    }]) as Array<{ content?: unknown }>

    expect(serializeMarkdownHighlightAwareBlocks(
      editor,
      injected as Parameters<typeof serializeMarkdownHighlightAwareBlocks>[1],
    )).toBe(markdown)
  })
})
