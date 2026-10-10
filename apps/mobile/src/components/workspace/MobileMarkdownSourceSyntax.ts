import type { StyleProp, TextStyle } from 'react-native'
import { editorStyles } from './MobileMarkdownSourceEditorStyles'

type MarkdownSource = string
type MarkdownSourceLine = string
type MarkdownLexeme = string

type MarkdownSyntaxToken = {
  style?: StyleProp<TextStyle>
  text: string
}

export function markdownSyntaxTokens(content: MarkdownSource): MarkdownSyntaxToken[] {
  if (!content) return []

  return content
    .split(/(\n)/u)
    .flatMap((part) => (part === '\n' ? [{ text: part }] : markdownSyntaxLineTokens(part)))
}

function markdownSyntaxLineTokens(line: MarkdownSourceLine): MarkdownSyntaxToken[] {
  if (/^\s*---\s*$/u.test(line)) return [{ style: editorStyles.syntaxMeta, text: line }]

  const frontmatterMatch = /^([A-Za-z0-9_-]+)(:\s*)/u.exec(line)
  if (frontmatterMatch) {
    const key = frontmatterMatch[1] ?? ''
    const separator = frontmatterMatch[2] ?? ''
    return [
      { style: editorStyles.syntaxPropertyKey, text: key },
      { style: editorStyles.syntaxMeta, text: separator },
      ...markdownInlineSyntaxTokens(line.slice(key.length + separator.length)),
    ]
  }

  const headingMatch = /^(\s{0,3}#{1,6}\s+)(.*)$/u.exec(line)
  if (headingMatch) {
    return [
      { style: editorStyles.syntaxMeta, text: headingMatch[1] ?? '' },
      { style: editorStyles.syntaxHeading, text: headingMatch[2] ?? '' },
    ]
  }

  if (/^\s*```/u.test(line)) return [{ style: editorStyles.syntaxCodeFence, text: line }]

  const blockquoteMatch = /^(\s*>+\s?)(.*)$/u.exec(line)
  if (blockquoteMatch) {
    return [
      { style: editorStyles.syntaxMeta, text: blockquoteMatch[1] ?? '' },
      { style: editorStyles.syntaxQuote, text: blockquoteMatch[2] ?? '' },
    ]
  }

  const listMatch = /^(\s*(?:[-*+]|\d+[.)])\s+)(.*)$/u.exec(line)
  if (listMatch) {
    return [
      { style: editorStyles.syntaxListMarker, text: listMatch[1] ?? '' },
      ...markdownInlineSyntaxTokens(listMatch[2] ?? ''),
    ]
  }

  if (line.includes('|')) return markdownInlineSyntaxTokens(line, editorStyles.syntaxTable)

  return markdownInlineSyntaxTokens(line)
}

function markdownInlineSyntaxTokens(line: MarkdownSourceLine, baseStyle?: StyleProp<TextStyle>): MarkdownSyntaxToken[] {
  const tokens: MarkdownSyntaxToken[] = []
  const syntaxPattern = /(`[^`]+`|\[\[[^\]]+\]\]|!\[[^\]]*\]\([^)]+\)|\*\*[^*]+\*\*|\*[^*]+\*)/gu
  let cursor = 0

  for (const match of line.matchAll(syntaxPattern)) {
    const index = match.index ?? 0
    if (index > cursor) tokens.push({ style: baseStyle, text: line.slice(cursor, index) })
    tokens.push({ style: markdownInlineTokenStyle(match[0]), text: match[0] })
    cursor = index + match[0].length
  }

  if (cursor < line.length) tokens.push({ style: baseStyle, text: line.slice(cursor) })
  return tokens.length > 0 ? tokens : [{ style: baseStyle, text: line }]
}

function markdownInlineTokenStyle(token: MarkdownLexeme): StyleProp<TextStyle> {
  if (token.startsWith('`')) return editorStyles.syntaxInlineCode
  if (token.startsWith('[[')) return editorStyles.syntaxWikilink
  if (token.startsWith('![')) return editorStyles.syntaxAttachment
  if (token.startsWith('**')) return editorStyles.syntaxStrong
  return editorStyles.syntaxEmphasis
}
