export interface ArrowLigatureChange {
  from: number
  insert: string
  to: number
}

export interface ArrowLigatureResolution {
  change: ArrowLigatureChange | null
  nextLiteralAsciiCursor: number | null
}

interface ResolveArrowLigatureInputParams {
  beforeText: string
  cursor: number
  inputText: string
  literalAsciiCursor: number | null
}

interface ArrowLigatureRule {
  insert: string
  nextLiteralAsciiCursor: number | null
  prefix: string
}

const ESCAPED_LEFT_ARROW_PREFIX = '\\<'
const ESCAPED_RIGHT_ARROW_PREFIX = '\\-'
const LEFT_ARROW = '←'
const LEFT_ARROW_PREFIX = '<'
const LEFT_RIGHT_ARROW = '↔'
const LEFT_RIGHT_ARROW_PREFIX = '<-'
const RIGHT_ARROW = '→'
const RIGHT_ARROW_PREFIX = '-'
const NO_LIGATURE_CHANGE: ArrowLigatureResolution = {
  change: null,
  nextLiteralAsciiCursor: null,
}

const INPUT_RULES: Record<string, readonly ArrowLigatureRule[]> = {
  '-': [
    {
      insert: LEFT_RIGHT_ARROW_PREFIX,
      nextLiteralAsciiCursor: 0,
      prefix: ESCAPED_LEFT_ARROW_PREFIX,
    },
    {
      insert: LEFT_ARROW,
      nextLiteralAsciiCursor: null,
      prefix: LEFT_ARROW_PREFIX,
    },
  ],
  '>': [
    {
      insert: `${RIGHT_ARROW_PREFIX}>`,
      nextLiteralAsciiCursor: null,
      prefix: ESCAPED_RIGHT_ARROW_PREFIX,
    },
    {
      insert: LEFT_RIGHT_ARROW,
      nextLiteralAsciiCursor: null,
      prefix: LEFT_ARROW,
    },
    {
      insert: LEFT_RIGHT_ARROW,
      nextLiteralAsciiCursor: null,
      prefix: LEFT_RIGHT_ARROW_PREFIX,
    },
    {
      insert: RIGHT_ARROW,
      nextLiteralAsciiCursor: null,
      prefix: RIGHT_ARROW_PREFIX,
    },
  ],
}

function buildChange(cursor: number, charsBeforeCursor: number, insert: string): ArrowLigatureChange {
  return {
    from: cursor - charsBeforeCursor,
    insert,
    to: cursor,
  }
}

function resolveMatchingRule(
  beforeText: string,
  inputText: string,
) {
  const rules = INPUT_RULES[inputText]
  return rules?.find((rule) => beforeText.endsWith(rule.prefix)) ?? null
}

function shouldKeepLiteralAsciiSequence(params: {
  beforeText: string
  cursor: number
  inputText: string
  literalAsciiCursor: number | null
}) {
  const { beforeText, cursor, inputText, literalAsciiCursor } = params
  return inputText === '>'
    && literalAsciiCursor === cursor
    && beforeText.endsWith(LEFT_RIGHT_ARROW_PREFIX)
}

function resolveNextLiteralAsciiCursor(
  cursor: number,
  rule: ArrowLigatureRule,
) {
  return rule.nextLiteralAsciiCursor === 0 ? cursor : null
}

function buildResolution(
  cursor: number,
  rule: ArrowLigatureRule | null,
): ArrowLigatureResolution {
  if (!rule) return NO_LIGATURE_CHANGE

  return {
    change: buildChange(cursor, rule.prefix.length, rule.insert),
    nextLiteralAsciiCursor: resolveNextLiteralAsciiCursor(cursor, rule),
  }
}

export function resolveArrowLigatureInput({
  beforeText,
  cursor,
  inputText,
  literalAsciiCursor,
}: ResolveArrowLigatureInputParams): ArrowLigatureResolution {
  if (inputText.length !== 1) return NO_LIGATURE_CHANGE

  if (shouldKeepLiteralAsciiSequence({
    beforeText,
    cursor,
    inputText,
    literalAsciiCursor,
  })) {
    return NO_LIGATURE_CHANGE
  }

  return buildResolution(cursor, resolveMatchingRule(beforeText, inputText))
}
