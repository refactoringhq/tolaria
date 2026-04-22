import { markdown } from '@codemirror/lang-markdown'
import { yamlFrontmatter } from '@codemirror/lang-yaml'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import type { Extension } from '@codemirror/state'

const markdownHighlightStyle = HighlightStyle.define([
  { tag: tags.heading1, color: 'var(--text-heading)', fontWeight: '700', fontSize: '1.4em' },
  { tag: tags.heading2, color: 'var(--text-heading)', fontWeight: '700', fontSize: '1.25em' },
  { tag: tags.heading3, color: 'var(--text-heading)', fontWeight: '600', fontSize: '1.1em' },
  { tag: tags.heading4, color: 'var(--text-heading)', fontWeight: '600' },
  { tag: tags.heading5, color: 'var(--text-heading)', fontWeight: '600' },
  { tag: tags.heading6, color: 'var(--text-heading)', fontWeight: '600' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.link, color: 'var(--link-color)', textDecoration: 'underline' },
  { tag: tags.url, color: 'var(--link-color)' },
  { tag: tags.monospace, color: 'var(--accent-red)', backgroundColor: 'var(--accent-red-light)', borderRadius: '3px' },
  { tag: tags.quote, color: 'var(--text-secondary)', fontStyle: 'italic' },
  { tag: tags.separator, color: 'var(--text-secondary)' },
  { tag: tags.processingInstruction, color: 'var(--accent-red)', fontWeight: '600' },
  { tag: tags.contentSeparator, color: 'var(--accent-red)', fontWeight: '600' },
])

export function markdownLanguage(): Extension {
  return [
    yamlFrontmatter({ content: markdown() }),
    syntaxHighlighting(markdownHighlightStyle),
  ]
}
