/**
 * Token contrast report (TOL-406): resolves the semantic roles in
 * src/index.css against src/styles/palette.css for light and dark and checks
 * the WCAG contrast of every text, icon, border and button pairing.
 */

export type ThemeName = 'light' | 'dark'
export type TokenMap = Map<string, string>

const LIGHT_SELECTOR = ':root, [data-theme="light"]'
const DARK_SELECTOR = ':root.dark, [data-theme="dark"]'
const SHARED_SELECTORS = new Set([':root', `${LIGHT_SELECTOR}, ${DARK_SELECTOR}`])
const BLOCK_PATTERN = /([^{}]+)\{([^{}]*)\}/g
const DECLARATION_PATTERN = /(--[\w-]+)\s*:\s*([^;]+);/g
const VAR_PATTERN = /^var\((--[\w-]+)[,)]/
const HEX_PATTERN = /^#([0-9a-fA-F]{6})$/

function blockSelector(block: RegExpMatchArray): string {
  return block[1].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim()
}

function blockDeclarations(block: RegExpMatchArray): [string, string][] {
  return Array.from(block[2].matchAll(DECLARATION_PATTERN), (match) => [match[1], match[2].trim()])
}

/** Declared custom properties for one theme: palette + shared aliases + that theme's roles. */
export function themeTokens(cssSources: string[], theme: ThemeName): TokenMap {
  const themeSelector = theme === 'light' ? LIGHT_SELECTOR : DARK_SELECTOR
  const blocks = Array.from(cssSources.join('\n').matchAll(BLOCK_PATTERN))
  const declarationsWhere = (wanted: (selector: string) => boolean) =>
    blocks.filter((block) => wanted(blockSelector(block))).flatMap(blockDeclarations)
  return new Map([
    ...declarationsWhere((selector) => SHARED_SELECTORS.has(selector)),
    ...declarationsWhere((selector) => selector === themeSelector),
  ])
}

/** Follows var() references until a hex value; returns null for anything else. */
export function resolveToken(tokens: TokenMap, name: string): string | null {
  const seen = new Set<string>()
  let value = tokens.get(name)
  while (value && !HEX_PATTERN.test(value)) {
    const reference = VAR_PATTERN.exec(value)?.[1]
    if (!reference || seen.has(reference)) return null
    seen.add(reference)
    value = tokens.get(reference)
  }
  return value ? value.toUpperCase() : null
}

function linearChannel(value: number): number {
  const normalized = value / 255
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
}

function relativeLuminance(hex: string): number {
  const [red, green, blue] = [1, 3, 5].map((offset) => linearChannel(parseInt(hex.slice(offset, offset + 2), 16)))
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

/** WCAG contrast ratio of two #RRGGBB colors. */
export function contrastRatio(...colors: [string, string]): number {
  const [lighter, darker] = colors.map(relativeLuminance).sort((a, b) => b - a)
  return (lighter + 0.05) / (darker + 0.05)
}

export interface ContrastPair {
  label: string
  foreground: string
  background: string
  minimum: number
  themeMinimums?: Partial<Record<ThemeName, number>>
}

export interface ContrastResult extends ContrastPair {
  theme: ThemeName
  foregroundHex: string | null
  backgroundHex: string | null
  ratio: number
  pass: boolean
}

const TEXT = 4.5
const NON_TEXT = 3
const HUES = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'teal', 'pink', 'gray']
const READING_SURFACES = ['--surface-app', '--surface-sidebar', '--surface-card', '--surface-popover', '--surface-dialog', '--state-hover']
const ICON_SURFACES = ['--surface-sidebar', '--surface-app', '--state-hover']
const INPUT_SURFACES = ['--surface-input', '--surface-app', '--surface-sidebar', '--surface-dialog']

type PairSpec = Omit<ContrastPair, 'background'>

function pairs(spec: PairSpec, backgrounds: string[]): ContrastPair[] {
  return backgrounds.map((background) => ({ ...spec, background }))
}

function hueChecks(hue: string): ContrastPair[] {
  // The approved yellow brand anchor stays unchanged even though its light-mode
  // icon contrast is below the otherwise required 3:1 floor.
  const yellowException = hue === 'yellow' ? { light: 2.1 } : undefined
  return [
    ...pairs({ label: `${hue} icon`, foreground: `--accent-${hue}`, minimum: NON_TEXT, themeMinimums: yellowException }, ICON_SURFACES),
    ...pairs({ label: `${hue} chip label`, foreground: `--accent-${hue}-text`, minimum: TEXT }, [`--accent-${hue}-light`]),
  ]
}

/** Every pairing TOL-406 promises, by role name. */
export const CONTRAST_PAIRS: ContrastPair[] = [
  ...pairs({ label: 'primary text', foreground: '--text-primary', minimum: TEXT }, READING_SURFACES),
  ...pairs({ label: 'secondary text', foreground: '--text-secondary', minimum: TEXT }, READING_SURFACES),
  ...pairs({ label: 'link text', foreground: '--accent-blue', minimum: TEXT }, ['--surface-app', '--surface-sidebar']),
  ...pairs({ label: 'count pill label', foreground: '--count-pill-text', minimum: TEXT }, ['--count-pill-bg']),
  ...pairs({ label: 'hovered count pill label', foreground: '--count-pill-text-hover', minimum: TEXT }, ['--count-pill-bg-hover']),
  ...pairs({ label: 'primary button text', foreground: '--primary-foreground', minimum: TEXT }, ['--primary', '--primary-hover']),
  ...pairs({ label: 'destructive button text', foreground: '--destructive-foreground', minimum: TEXT }, ['--destructive', '--destructive-hover']),
  ...pairs({ label: 'success button text', foreground: '--text-on-fill', minimum: TEXT }, ['--fill-success', '--fill-success-hover']),
  ...pairs({ label: 'warning label', foreground: '--feedback-warning-text', minimum: TEXT }, ['--feedback-warning-bg']),
  ...pairs({ label: 'warning border', foreground: '--feedback-warning-border', minimum: NON_TEXT }, ['--feedback-warning-bg', '--surface-app']),
  ...pairs({ label: 'input border', foreground: '--border-input', minimum: NON_TEXT }, INPUT_SURFACES),
  ...pairs({ label: 'focus ring', foreground: '--border-focus', minimum: NON_TEXT }, INPUT_SURFACES),
  ...HUES.flatMap(hueChecks),
]

function evaluatePair(tokens: TokenMap, theme: ThemeName, pair: ContrastPair): ContrastResult {
  const foregroundHex = resolveToken(tokens, pair.foreground)
  const backgroundHex = resolveToken(tokens, pair.background)
  const ratio = foregroundHex && backgroundHex ? contrastRatio(foregroundHex, backgroundHex) : 0
  const themeMinimum = theme === 'light'
    ? pair.themeMinimums?.light
    : pair.themeMinimums?.dark
  const minimum = themeMinimum ?? pair.minimum
  return { ...pair, minimum, theme, foregroundHex, backgroundHex, ratio, pass: ratio >= minimum }
}

export function buildContrastReport(cssSources: string[], checks: ContrastPair[] = CONTRAST_PAIRS): ContrastResult[] {
  return (['light', 'dark'] as const).flatMap((theme) => {
    const tokens = themeTokens(cssSources, theme)
    return checks.map((pair) => evaluatePair(tokens, theme, pair))
  })
}

function formatRow(result: ContrastResult): string {
  const cells = [
    result.theme,
    result.label,
    `${result.foreground} ${result.foregroundHex ?? '?'}`,
    `${result.background} ${result.backgroundHex ?? '?'}`,
    `${result.ratio.toFixed(2)}:1`,
    `${result.minimum}:1`,
    result.pass ? 'PASS' : 'FAIL',
  ]
  return `| ${cells.join(' | ')} |`
}

export function formatContrastReport(results: ContrastResult[]): string {
  const failures = results.filter((result) => !result.pass).length
  return [
    '| Theme | Check | Foreground | Background | Ratio | Minimum | Result |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...results.map(formatRow),
    '',
    `${results.length - failures}/${results.length} checks pass.`,
  ].join('\n')
}
