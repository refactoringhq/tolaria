import { BlockNoteEditor } from '@blocknote/core'
import { describe, expect, it } from 'vitest'
import { schema } from '../components/editorSchema'
import {
  INLINE_BACKGROUND_COLOR_STYLE,
  INLINE_COLOR_HEX_BY_VALUE,
  INLINE_TEXT_COLOR_STYLE,
  injectInlineColorsInBlocks,
  preProcessInlineColorMarkdown,
  restoreInlineColorsInBlocks,
} from './inlineColorMarkdown'
import {
  injectRichEditorMarkdownBlocks,
  installRichEditorMarkdownSerializer,
  preProcessRichEditorMarkdown,
  serializeRichEditorBlocksToMarkdown,
  serializeRichEditorBodyToMarkdown,
} from './richEditorMarkdown'

const RED_TEXT_SPAN = '<span style="color:#e03e3e">red</span>'
const TOKEN_PREFIX = '\uE000'

interface TextItem {
  type: string
  text?: string
  styles?: Record<string, unknown>
}

function textItems(content: unknown): TextItem[] {
  return (content as TextItem[] | undefined) ?? []
}

function inlineContentText(content: unknown): string {
  return textItems(content).map(item => item.text ?? '').join('')
}

function firstBlockContent(blocks: unknown[]): unknown {
  return (blocks[0] as { content?: unknown } | undefined)?.content
}

interface TableBlockLike {
  content?: { rows?: Array<{ cells?: Array<{ content?: unknown }> }> }
}

function tableCellContent(block: unknown): unknown {
  return (block as TableBlockLike).content?.rows?.at(0)?.cells?.at(0)?.content
}

async function parseBody(markdown: string) {
  const editor = BlockNoteEditor.create({ schema })
  const blocks = await editor.tryParseMarkdownToBlocks(preProcessRichEditorMarkdown(markdown))
  return { editor, blocks: injectRichEditorMarkdownBlocks(blocks) }
}

describe('inline color Markdown preprocessing', () => {
  it('hides formatting-toolbar color spans from the Markdown parser', () => {
    const preprocessed = preProcessInlineColorMarkdown({
      markdown: `${RED_TEXT_SPAN} plain`,
    })

    expect(preprocessed).not.toContain('<span')
    expect(preprocessed).toContain('red')
    expect(preprocessed).not.toContain('</span>')
  })

  it('leaves unknown colors, plain HTML, and code spans untouched', () => {
    const markdown = [
      '<span style="color:#123456">custom</span>',
      'Inline `<span style="color:#e03e3e">code</span>` stays literal.',
      '```html',
      '<span style="color:#e03e3e">fenced</span>',
      '```',
    ].join('\n')

    const preprocessed = preProcessInlineColorMarkdown({ markdown })

    expect(preprocessed).toBe(markdown)
  })
})

describe('inline color Markdown round-trip', () => {
  it('restores persisted text and background colors as rich-editor styles', async () => {
    const { blocks } = await parseBody(
      '<span style="color:#e03e3e"><span style="background-color:#0b6e99">painted</span></span> plain',
    )

    expect(inlineContentText(firstBlockContent(blocks))).toBe('painted plain')
    expect(textItems(firstBlockContent(blocks))).toEqual([
      {
        type: 'text',
        text: 'painted',
        styles: {
          [INLINE_TEXT_COLOR_STYLE]: 'red',
          [INLINE_BACKGROUND_COLOR_STYLE]: 'blue',
        },
      },
      { type: 'text', text: ' plain', styles: {} },
    ])
  })

  it('applies persisted spans to parsed inline content', async () => {
    const editor = BlockNoteEditor.create({ schema })
    const parsed = await editor.tryParseMarkdownToBlocks(
      preProcessInlineColorMarkdown({ markdown: RED_TEXT_SPAN }),
    )

    const injected = injectInlineColorsInBlocks(parsed)

    expect(textItems(firstBlockContent(injected))).toEqual([
      { type: 'text', text: 'red', styles: { [INLINE_TEXT_COLOR_STYLE]: 'red' } },
    ])
  })

  it('writes rich-editor colors back as inline HTML spans', () => {
    const blocks = restoreInlineColorsInBlocks([{
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'painted',
          styles: {
            [INLINE_TEXT_COLOR_STYLE]: 'red',
            [INLINE_BACKGROUND_COLOR_STYLE]: 'blue',
          },
        },
        { type: 'text', text: ' plain', styles: {} },
      ],
      children: [],
    }])

    expect(inlineContentText(firstBlockContent(blocks))).toBe(
      '<span style="color:#e03e3e"><span style="background-color:#0b6e99">painted</span></span> plain',
    )
    expect(textItems(firstBlockContent(blocks)).at(2)?.styles).toEqual({})
  })

  it('closes color spans at run boundaries instead of leaking them forward', () => {
    const blocks = restoreInlineColorsInBlocks([{
      type: 'paragraph',
      content: [
        { type: 'text', text: 'red run', styles: { [INLINE_TEXT_COLOR_STYLE]: 'red' } },
        { type: 'text', text: ' plain run ', styles: {} },
        { type: 'text', text: 'blue run', styles: { [INLINE_BACKGROUND_COLOR_STYLE]: 'blue' } },
      ],
      children: [],
    }])

    expect(inlineContentText(firstBlockContent(blocks))).toBe(
      `<span style="color:${INLINE_COLOR_HEX_BY_VALUE.red}">red run</span> plain run `
      + `<span style="background-color:${INLINE_COLOR_HEX_BY_VALUE.blue}">blue run</span>`,
    )
  })

  it('leaves code blocks alone and colors table cells', () => {
    const blocks = restoreInlineColorsInBlocks([
      {
        type: 'codeBlock',
        content: [{ type: 'text', text: RED_TEXT_SPAN, styles: {} }],
        children: [],
      },
      {
        type: 'table',
        content: {
          type: 'tableContent',
          rows: [{
            cells: [{
              content: [{
                type: 'text',
                text: 'cell',
                styles: { [INLINE_TEXT_COLOR_STYLE]: 'red' },
              }],
            }],
          }],
        },
        children: [],
      },
    ])

    expect(inlineContentText(firstBlockContent(blocks))).toBe(RED_TEXT_SPAN)
    expect(inlineContentText(tableCellContent(blocks[1]))).toBe(
      '<span style="color:#e03e3e">cell</span>',
    )
  })
})

describe('inline color persistence through the rich-editor pipeline', () => {
  it('round-trips toolbar colors through save and reload', async () => {
    const editor = BlockNoteEditor.create({
      schema,
      initialContent: [{
        type: 'paragraph',
        id: 'colored-note',
        content: [{
          type: 'text',
          text: 'painted words',
          styles: {
            [INLINE_TEXT_COLOR_STYLE]: 'red',
            [INLINE_BACKGROUND_COLOR_STYLE]: 'blue',
          },
        }],
      }],
    })
    installRichEditorMarkdownSerializer(editor)

    const markdown = serializeRichEditorBodyToMarkdown(editor as never)
    expect(markdown).toContain(
      '<span style="color:#e03e3e"><span style="background-color:#0b6e99">painted words</span></span>',
    )

    const reloaded = await parseBody(markdown.trim())
    expect(textItems(firstBlockContent(reloaded.blocks))).toEqual([
      {
        type: 'text',
        text: 'painted words',
        styles: {
          [INLINE_TEXT_COLOR_STYLE]: 'red',
          [INLINE_BACKGROUND_COLOR_STYLE]: 'blue',
        },
      },
    ])
    expect(JSON.stringify(reloaded.blocks)).not.toContain(TOKEN_PREFIX)
  })

  it('persists the styles the formatting toolbar applies to a selection', async () => {
    const editor = BlockNoteEditor.create({
      schema,
      initialContent: [{
        type: 'paragraph',
        id: 'toolbar-note',
        content: 'painted words',
      }],
    })
    editor.setTextCursorPosition(editor.document[0], 'end')
    editor._tiptapEditor.commands.selectAll()
    editor.addStyles({
      [INLINE_TEXT_COLOR_STYLE]: 'orange',
      [INLINE_BACKGROUND_COLOR_STYLE]: 'yellow',
    })

    const markdown = serializeRichEditorBodyToMarkdown(editor as never)

    expect(markdown).toContain(
      '<span style="color:#d9730d"><span style="background-color:#dfab01">painted words</span></span>',
    )
  })

  it('keeps notes without colors byte-identical', async () => {
    const { editor, blocks } = await parseBody('Plain ==highlighted== and `code` stay untouched.')

    const markdown = serializeRichEditorBlocksToMarkdown({ blocks, editor })

    expect(markdown).toBe('Plain ==highlighted== and `code` stay untouched.\n')
    expect(markdown).not.toContain('<span')
  })

  it('keeps Bear-style colored highlights on the highlight dialect', async () => {
    const highlighted = '==🔴red== ==🔵blue== ==🟣purple== ==🟢green== ==yellow=='
    const { editor, blocks } = await parseBody(highlighted)

    const markdown = serializeRichEditorBlocksToMarkdown({ blocks, editor })

    expect(markdown).toBe(`${highlighted}\n`)
    expect(markdown).not.toContain('<span')
  })
})
