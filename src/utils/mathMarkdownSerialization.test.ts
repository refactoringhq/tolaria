import { BlockNoteEditor } from '@blocknote/core'
import { describe, expect, it } from 'vitest'
import { schema } from '../components/editorSchema'
import { resolveBlocksForTarget } from '../hooks/editorBlockResolution'
import { MATH_BLOCK_TYPE, MATH_INLINE_TYPE } from './mathMarkdown'
import { installRichEditorMarkdownSerializer, serializeRichEditorDocumentToMarkdown } from './richEditorMarkdown'

const path = '/vault/math.md'

function richEditor() {
  const editor = BlockNoteEditor.create({ schema })
  installRichEditorMarkdownSerializer(editor)
  return editor
}

async function reopen(markdown: string) {
  const editor = richEditor()
  const { blocks } = await resolveBlocksForTarget({ editor, cache: new Map(), content: markdown, targetPath: path })
  editor.replaceBlocks(editor.document, blocks)
  return serializeRichEditorDocumentToMarkdown({ editor, tabContent: '', notePath: path })
}

describe('math markdown serialization', () => {
  it('saves typed inline and display math with subscripts verbatim', () => {
    const editor = richEditor()
    editor.replaceBlocks(editor.document, [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Voltage ', styles: {} },
          { type: MATH_INLINE_TYPE, props: { latex: 'V_{AB}' } },
          { type: 'text', text: ' and ', styles: {} },
          { type: MATH_INLINE_TYPE, props: { latex: 'x_1^2 * y_{i,j} \\\\ \\{a\\}' } },
        ],
      },
      { type: MATH_BLOCK_TYPE, props: { latex: 'V_{AB} = I_{A} R_{B}' } },
    ])

    expect(serializeRichEditorDocumentToMarkdown({ editor, tabContent: '', notePath: path })).toBe(
      'Voltage $V_{AB}$ and $x_1^2 * y_{i,j} \\\\ \\{a\\}$\n\n$$\nV_{AB} = I_{A} R_{B}\n$$\n',
    )
  })

  it('keeps math unchanged across repeated reopen and save cycles', async () => {
    const markdown = [
      'Inline $V_{AB}$ in a sentence with snake_case and _emphasis_ text.',
      '',
      '$$',
      'E_{k} = \\frac{1}{2} m v_{0}^2',
      '$$',
      '',
      'Prices like $5 and $10 stay literal, and a stray _ is escaped.',
      '',
      '> [!note] Ohm',
      '> Drop across $V_{AB} = I_{A} R_{B}$ here.',
      '',
    ].join('\n')

    const firstSave = await reopen(markdown)
    expect(firstSave).toContain('$V_{AB}$')
    expect(firstSave).toContain('E_{k} = \\frac{1}{2} m v_{0}^2')
    expect(firstSave).toContain('snake_case')
    expect(firstSave).toContain('Prices like $5 and $10 stay literal')
    expect(firstSave).toContain('stray \\_ is escaped')
    expect(firstSave).toContain('> Drop across $V_{AB} = I_{A} R_{B}$ here.')
    expect(await reopen(firstSave)).toBe(firstSave)
  })
})
