const INLINE_MARKDOWN_PATTERNS = [
  /~~(\S[^~]*\S|\S)~~/gu,
  /\[([^\]]+)\]\([^)]+\)/gu,
  /\[\[[^|\]]+\|([^\]]+)\]\]/gu,
  /\[\[([^\]]+)\]\]/gu,
  /\[\[([^\]]*)$/gu,
]

export function stripInlineMarkdown(text: string): string {
  const withoutLinks = INLINE_MARKDOWN_PATTERNS.reduce(
    (result, pattern) => result.replace(pattern, '$1'),
    text,
  )
  return withoutLinks
    .replace(/(?<!\\)(?<![\p{L}\p{N}])_|(?<!\\)_(?![\p{L}\p{N}])/gu, '')
    .replace(/(?<!\\)[*`]/gu, '')
    .replace(/\\([*_`])/gu, '$1')
    .trim()
}
