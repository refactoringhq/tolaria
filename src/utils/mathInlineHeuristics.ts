interface LatexPayload {
  latex: string
}

interface MathCandidate {
  text: string
}

interface CandidatePosition extends MathCandidate {
  index: number
}

interface LeadingAmount {
  end: number
}

interface CharacterProbe {
  char: string
}

export function isValidInlineLatex({ latex }: LatexPayload): boolean {
  const candidate = { text: latex.trim() }
  return Boolean(candidate.text)
    && !/^\s|\s$/.test(latex)
    && !looksLikeFinancialProse(candidate)
    && looksLikeIntentionalMath(candidate)
}

function looksLikeIntentionalMath(candidate: MathCandidate): boolean {
  if (isSimpleVariable(candidate)) return true
  if (startsWithLikelyCurrencyAmount(candidate)) return false
  if (hasCoefficientVariableSyntax(candidate)) return true
  if (!hasMathSyntax(candidate)) return false
  if (hasLatexCommand(candidate)) return true
  return !hasPlainProseWord(candidate)
}

function isSimpleVariable({ text }: MathCandidate): boolean {
  return /^[A-Za-z][\u0027\u2019]?$/u.test(text)
}

function hasLatexCommand({ text }: MathCandidate): boolean {
  return /\\[A-Za-z]+/u.test(text)
}

function hasMathSyntax(candidate: MathCandidate): boolean {
  return hasLatexCommand(candidate)
    || /[-+*/=<>^_{}~]/u.test(candidate.text)
}

function hasPlainProseWord({ text }: MathCandidate): boolean {
  const withoutCommands = text.replace(/\\[A-Za-z]+/gu, '')
  return /[A-Za-z]{3,}/u.test(withoutCommands)
}

function startsWithLikelyCurrencyAmount(candidate: MathCandidate): boolean {
  const amount = readLeadingAmount(candidate)
  return amount !== null && (
    amountBoundaryLooksLikeCurrency({ text: candidate.text, index: amount.end })
    || amountSpanLacksMathIntent(candidate)
  )
}

function readLeadingAmount({ text }: MathCandidate): LeadingAmount | null {
  const match = /^[\d,]+(?:\.\d+)?(?:[KMBT%])?/iu.exec(text)
  if (!match) return null
  return { end: match[0].length }
}

function amountBoundaryLooksLikeCurrency({ text, index }: CandidatePosition): boolean {
  const nextChar = text.charAt(index)
  if (!nextChar) return true
  return (nextChar === '/' && isAsciiLetter(text.charAt(index + 1)))
    || nextChar === ','
    || nextChar === ')'
    || /\s/u.test(nextChar)
}

function amountSpanLacksMathIntent(candidate: MathCandidate): boolean {
  if (hasCoefficientVariableSyntax(candidate)) return false
  return !hasMathSyntax(candidate) || hasPlainProseWord(candidate)
}

function hasCoefficientVariableSyntax({ text }: MathCandidate): boolean {
  return /^[\d,]+(?:\.\d+)?[A-Za-z]{1,2}\d?(?:[_^][A-Za-z0-9{}]+)?$/u.test(text)
}

function looksLikeFinancialProse(candidate: MathCandidate): boolean {
  return hasFinancialAmountPrefix(candidate) && hasProseAfterAmount(candidate)
}

function hasFinancialAmountPrefix({ text }: MathCandidate): boolean {
  const integerEnd = scanIntegerAmount({ text })
  if (integerEnd === 0) return false

  const suffixIndex = scanDecimalAmount({ text, index: integerEnd })
  if (!isFinancialSuffix({ char: text.charAt(suffixIndex) })) return false

  const nextChar = text.charAt(suffixIndex + 1)
  return nextChar === ',' || nextChar === '.' || nextChar === ')' || /\s/.test(nextChar)
}

function scanIntegerAmount({ text }: MathCandidate): number {
  if (!isAsciiDigit(text.charAt(0))) return 0

  let index = 0
  while (isAsciiDigit(text.charAt(index)) || text.charAt(index) === ',') index += 1
  return index
}

function scanDecimalAmount({ text, index }: CandidatePosition): number {
  if (text.charAt(index) !== '.') return index

  let nextIndex = index + 1
  if (!isAsciiDigit(text.charAt(nextIndex))) return index
  while (isAsciiDigit(text.charAt(nextIndex))) nextIndex += 1
  return nextIndex
}

function isFinancialSuffix({ char }: CharacterProbe): boolean {
  return 'KMBT%'.includes(char.toUpperCase())
}

function hasProseAfterAmount({ text }: MathCandidate): boolean {
  for (let index = 0; index < text.length - 2; index += 1) {
    if (startsProseAt({ text, index })) return true
  }
  return false
}

function startsProseAt({ text, index }: CandidatePosition): boolean {
  const current = text.charAt(index)
  const next = text.charAt(index + 1)
  if ((current === ',' || current === '.') && /\s/.test(next)) return true
  return /\s/.test(current) && isAsciiLetter(next) && isAsciiLetter(text.charAt(index + 2))
}

export function isAsciiDigit(char: string): boolean {
  return char >= '0' && char <= '9'
}

export function isAsciiLetter(char: string): boolean {
  const lowerChar = char.toLowerCase()
  return lowerChar >= 'a' && lowerChar <= 'z'
}
