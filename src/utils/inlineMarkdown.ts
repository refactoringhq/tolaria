const INLINE_MARKDOWN_PATTERNS = [
  /~~(\S[^~]*\S|\S)~~/gu,
  /\[([^\]]+)\]\([^)]+\)/gu,
  /\[\[[^|\]]+\|([^\]]+)\]\]/gu,
  /\[\[([^\]]+)\]\]/gu,
  /\[\[([^\]]*)$/gu,
]
const LETTER_OR_NUMBER_PATTERN = /[\p{L}\p{N}]/u

function isLetterOrNumber(value: string | undefined): boolean {
  return value !== undefined && LETTER_OR_NUMBER_PATTERN.test(value)
}

function isEscapableInlineMarker(value: string | undefined): boolean {
  return value === '*' || value === '_' || value === '`'
}

function shouldRemoveInlineMarker(
  character: string | undefined,
  previousCharacter: string | undefined,
  nextCharacter: string | undefined,
): boolean {
  if (character === '*' || character === '`') return true
  if (character !== '_') return false
  return !isLetterOrNumber(previousCharacter) || !isLetterOrNumber(nextCharacter)
}

function nextCharacter(iterator: ArrayIterator<string>): string | undefined {
  const result = iterator.next()
  return result.done ? undefined : result.value
}

function stripInlineMarkers(text: string): string {
  const iterator = Array.from(text).values()
  let result = ''
  let previousCharacter: string | undefined
  let character = nextCharacter(iterator)
  let followingCharacter = nextCharacter(iterator)

  while (character !== undefined) {
    if (character === '\\' && isEscapableInlineMarker(followingCharacter)) {
      result += followingCharacter
      previousCharacter = followingCharacter
      character = nextCharacter(iterator)
      followingCharacter = nextCharacter(iterator)
      continue
    }
    if (!shouldRemoveInlineMarker(character, previousCharacter, followingCharacter)) result += character
    previousCharacter = character
    character = followingCharacter
    followingCharacter = nextCharacter(iterator)
  }

  return result
}

export function stripInlineMarkdown(text: string): string {
  const withoutLinks = INLINE_MARKDOWN_PATTERNS.reduce(
    (result, pattern) => result.replace(pattern, '$1'),
    text,
  )
  return stripInlineMarkers(withoutLinks).trim()
}
