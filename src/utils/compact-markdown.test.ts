import { describe, it, expect } from 'vitest'
import { compactMarkdown } from './compact-markdown'

describe('compactMarkdown', () => {
  it('collapses blank lines between bullet list items (tight list)', () => {
    const input = '* Item one\n\n* Item two\n\n* Item three\n'
    expect(compactMarkdown(input)).toBe('* Item one\n* Item two\n* Item three\n')
  })

  it('collapses blank lines between dash list items', () => {
    const input = '- Item one\n\n- Item two\n\n- Item three\n'
    expect(compactMarkdown(input)).toBe('- Item one\n- Item two\n- Item three\n')
  })

  it('collapses blank lines between numbered list items', () => {
    const input = '1. First\n\n2. Second\n\n3. Third\n'
    expect(compactMarkdown(input)).toBe('1. First\n2. Second\n3. Third\n')
  })

  it('removes extra blank line after heading', () => {
    const input = '## Personal\n\n* Back on track\n\n* Good health\n'
    expect(compactMarkdown(input)).toBe('## Personal\n\n* Back on track\n* Good health\n')
  })

  it('preserves single blank line between heading and content', () => {
    const input = '## Title\n\nSome paragraph text.\n'
    expect(compactMarkdown(input)).toBe('## Title\n\nSome paragraph text.\n')
  })

  it('collapses multiple blank lines after heading to one', () => {
    const input = '## Title\n\n\n\nSome paragraph text.\n'
    expect(compactMarkdown(input)).toBe('## Title\n\nSome paragraph text.\n')
  })

  it('preserves blank lines between paragraphs', () => {
    const input = 'First paragraph.\n\nSecond paragraph.\n'
    expect(compactMarkdown(input)).toBe('First paragraph.\n\nSecond paragraph.\n')
  })

  it('preserves blank lines inside fenced code blocks', () => {
    const input = '```\nline one\n\nline two\n\nline three\n```\n'
    expect(compactMarkdown(input)).toBe('```\nline one\n\nline two\n\nline three\n```\n')
  })

  it('preserves blank lines inside fenced code blocks with language', () => {
    const input = '```js\nconst a = 1\n\nconst b = 2\n```\n'
    expect(compactMarkdown(input)).toBe('```js\nconst a = 1\n\nconst b = 2\n```\n')
  })

  it('does not add trailing blank lines', () => {
    const input = '## Title\n\nText.\n\n\n'
    expect(compactMarkdown(input)).toBe('## Title\n\nText.\n')
  })

  it('handles the exact bug scenario from the issue', () => {
    const input = '## Personal\n\n* Back on track with Flavia\n\n* Good health vitals in place\n\n'
    expect(compactMarkdown(input)).toBe('## Personal\n\n* Back on track with Flavia\n* Good health vitals in place\n')
  })

  it('handles heading followed immediately by list (no blank line)', () => {
    const input = '## Title\n* Item one\n\n* Item two\n'
    expect(compactMarkdown(input)).toBe('## Title\n* Item one\n* Item two\n')
  })

  it('handles mixed content: heading, paragraph, list', () => {
    const input = '# Title\n\nSome intro.\n\n* Item one\n\n* Item two\n\nConclusion.\n'
    expect(compactMarkdown(input)).toBe('# Title\n\nSome intro.\n\n* Item one\n* Item two\n\nConclusion.\n')
  })

  it('preserves empty input', () => {
    expect(compactMarkdown('')).toBe('')
  })

  it('preserves single line', () => {
    expect(compactMarkdown('Hello\n')).toBe('Hello\n')
  })

  it('collapses 3+ consecutive blank lines to one blank line', () => {
    const input = 'Paragraph one.\n\n\n\nParagraph two.\n'
    expect(compactMarkdown(input)).toBe('Paragraph one.\n\nParagraph two.\n')
  })

  it('handles list after code block', () => {
    const input = '```\ncode\n```\n\n* Item one\n\n* Item two\n'
    expect(compactMarkdown(input)).toBe('```\ncode\n```\n\n* Item one\n* Item two\n')
  })

  it('handles nested list items', () => {
    const input = '* Parent\n\n  * Child one\n\n  * Child two\n'
    expect(compactMarkdown(input)).toBe('* Parent\n  * Child one\n  * Child two\n')
  })

  it('handles checklist items', () => {
    const input = '* [ ] Todo one\n\n* [ ] Todo two\n\n* [x] Done\n'
    expect(compactMarkdown(input)).toBe('* [ ] Todo one\n* [ ] Todo two\n* [x] Done\n')
  })

  it('handles blockquotes normally', () => {
    const input = '> Quote line one\n\n> Quote line two\n'
    expect(compactMarkdown(input)).toBe('> Quote line one\n\n> Quote line two\n')
  })
})
