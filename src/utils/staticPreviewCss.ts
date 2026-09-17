const INTERACTION_STATE_PATTERN = /:(?:hover|focus|focus-within|focus-visible|active|visited|checked|target|disabled|enabled|placeholder-shown)\b/iu
const DOCUMENT_ROOT_SELECTOR_PATTERN = /^(?:html|body)\b/iu
const AT_RULE_PATTERN = /^@/u
const FULL_HEIGHT_PATTERN = /^100(?:%|vh)$/u

const INSET_PROPERTIES = ['inset', 'top', 'right', 'bottom', 'left'] as const
const PROPERTY_SEPARATOR = ':'

interface ParsedRule {
  selector: string
  declarations: string[]
}

interface Declaration {
  property: string
  value: string
}

function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//gu, ' ')
}

function skipQuotedText(css: string, startIndex: number): number {
  const quote = css.charAt(startIndex)
  let index = startIndex + 1
  while (index < css.length) {
    if (css.charAt(index) === '\\') {
      index += 2
      continue
    }
    if (css.charAt(index) === quote) return index + 1
    index += 1
  }
  return css.length
}

function findBlockEnd(css: string, openBraceIndex: number): number {
  let depth = 0
  let index = openBraceIndex
  while (index < css.length) {
    const character = css.charAt(index)
    if (character === '"' || character === "'") {
      index = skipQuotedText(css, index)
      continue
    }
    if (character === '{') depth += 1
    if (character === '}') {
      depth -= 1
      if (depth === 0) return index + 1
    }
    index += 1
  }
  return css.length
}

function parseDeclaration(raw: string): Declaration | null {
  const separatorIndex = raw.indexOf(PROPERTY_SEPARATOR)
  if (separatorIndex <= 0) return null

  const property = raw.slice(0, separatorIndex).trim().toLowerCase()
  const value = raw.slice(separatorIndex + 1).trim().replace(/!\s*important$/iu, '').trim()
  if (!property || !value) return null
  return { property, value }
}

function parseDeclarations(block: string): string[] {
  return block
    .split(';')
    .map(parseDeclaration)
    .filter((declaration): declaration is Declaration => declaration !== null)
    .map(({ property, value }) => `${property}:${value}`)
}

function parseRules(css: string): ParsedRule[] {
  const rules: ParsedRule[] = []
  let index = 0
  while (index < css.length) {
    const openBraceIndex = css.indexOf('{', index)
    if (openBraceIndex < 0) break

    const prelude = css.slice(index, openBraceIndex).trim()
    const blockEnd = findBlockEnd(css, openBraceIndex)
    if (AT_RULE_PATTERN.test(prelude)) {
      index = blockEnd
      continue
    }

    const block = css.slice(openBraceIndex + 1, blockEnd - 1)
    if (!block.includes('{')) {
      rules.push({ selector: prelude, declarations: parseDeclarations(block) })
    }
    index = blockEnd
  }
  return rules
}

function declarationProperties(declarations: string[]): Set<string> {
  return new Set(declarations.map(declaration => declaration.slice(0, declaration.indexOf(PROPERTY_SEPARATOR))))
}

function isFullscreenPinned(declarations: string[]): boolean {
  const properties = declarationProperties(declarations)
  const verticalLock = properties.has('top') && properties.has('bottom')
  const horizontalLock = properties.has('left') && properties.has('right')
  return properties.has('inset') || verticalLock || horizontalLock
}

function isZeroOpacity(value: string): boolean {
  return Number.parseFloat(value) === 0
}

function isHiddenDeclaration(declaration: string): boolean {
  if (declaration === 'visibility:hidden') return true
  if (!declaration.startsWith('opacity:')) return false
  return isZeroOpacity(declaration.slice('opacity:'.length))
}

function isDocumentRootSelector(selector: string): boolean {
  return DOCUMENT_ROOT_SELECTOR_PATTERN.test(selector)
}

function revealHiddenState(reveal: (property: string, value: string) => void): void {
  reveal('opacity', '1')
  reveal('visibility', 'visible')
  reveal('transform', 'none')
  reveal('pointer-events', 'auto')
}

function revealPinnedPosition(reveal: (property: string, value: string) => void): void {
  reveal('position', 'static')
  for (const property of INSET_PROPERTIES) reveal(property, 'auto')
  reveal('transform', 'none')
  reveal('pointer-events', 'auto')
}

function revealDocumentRootUnlock(selector: string, declarations: string[], reveal: (property: string, value: string) => void): void {
  if (!isDocumentRootSelector(selector)) return
  if (declarations.includes('overflow:hidden')) reveal('overflow', 'auto')
  const hasFullHeight = declarations.some(declaration => (
    declaration.startsWith('height:') && FULL_HEIGHT_PATTERN.test(declaration.slice('height:'.length))
  ))
  if (hasFullHeight) reveal('height', 'auto')
}

function revealDeclarationsFor(selector: string, declarations: string[]): string[] {
  const reveals: string[] = []
  const reveal = (property: string, value: string) => {
    if (!reveals.some(entry => entry.startsWith(`${property}:`))) {
      reveals.push(`${property}:${value} !important`)
    }
  }

  const hasHiddenState = declarations.some(isHiddenDeclaration)
  const isPinned = declarations.includes('position:fixed')
    || (declarations.includes('position:absolute') && isFullscreenPinned(declarations))

  if (hasHiddenState) revealHiddenState(reveal)
  if (isPinned) revealPinnedPosition(reveal)
  revealDocumentRootUnlock(selector, declarations, reveal)
  return reveals
}

function keepSelector(selector: string): boolean {
  return selector.length > 0 && !INTERACTION_STATE_PATTERN.test(selector)
}

function splitSelectableSelectors(ruleSelector: string): string[] {
  return ruleSelector
    .split(',')
    .map(selector => selector.trim())
    .filter(keepSelector)
}

export function buildStaticPreviewRevealCss(cssText: string): string {
  const revealRules: string[] = []
  for (const rule of parseRules(stripCssComments(cssText))) {
    const reveals = revealDeclarationsFor(rule.selector, rule.declarations)
    if (reveals.length === 0) continue
    for (const selector of splitSelectableSelectors(rule.selector)) {
      revealRules.push(`${selector}{${reveals.join(';')}}`)
    }
  }
  return revealRules.join('\n')
}

export function appendStaticPreviewCss(documentObject: Document): void {
  const styleTexts = Array.from(documentObject.querySelectorAll('style'))
    .map(style => style.textContent ?? '')
  const revealCss = buildStaticPreviewRevealCss(styleTexts.join('\n'))
  if (revealCss.length === 0) return

  const style = documentObject.createElement('style')
  style.setAttribute('data-tolaria-static-preview', '')
  style.textContent = revealCss
  documentObject.documentElement.append(style)
}
