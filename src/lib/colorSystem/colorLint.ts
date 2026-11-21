/**
 * Color lint (TOL-406): product code may only use colors from the palette in
 * src/styles/palette.css through the semantic roles in src/index.css.
 * Raw color literals and opacity-invented colors fail the check.
 */

export interface ColorViolation {
  path: string
  line: number
  rule: ColorRuleId
  match: string
}

export type ColorRuleId =
  | 'raw-hex'
  | 'raw-color-function'
  | 'color-mix'
  | 'tailwind-opacity-modifier'
  | 'tailwind-raw-palette'

interface ColorRule {
  id: ColorRuleId
  pattern: RegExp
}

// Color utilities: bg, text, border(-side), ring(-offset), fill, stroke, outline, divide, shadow,
// decoration, gradient stops, placeholder, caret and accent.
const OPACITY_MODIFIER =
  /(?<![\w-])(?:bg|text|border|ring|fill|stroke|outline|divide|shadow|decoration|from|to|via|placeholder|caret|accent)-[a-z[][^\s/"'`]*\/\d+/g
const RAW_TAILWIND_PALETTE =
  /(?<![\w-])(?:bg|text|border(?:-[trblxy])?|ring(?:-offset)?|fill|stroke|outline|divide|shadow|decoration|from|to|via|placeholder|caret|accent)-(?:(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}|white|black)(?![\w-])/g
const TEXT_SIZE_UTILITY = /^text-(?:xs|sm|base|lg|[2-9]?xl|\[\d+px\])\//

const COLOR_RULES: ColorRule[] = [
  { id: 'raw-hex', pattern: /(?<![\w&/-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g },
  { id: 'raw-color-function', pattern: /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/g },
  { id: 'color-mix', pattern: /\bcolor-mix\(/g },
  {
    id: 'tailwind-opacity-modifier',
    pattern: OPACITY_MODIFIER,
  },
  {
    id: 'tailwind-raw-palette',
    pattern: RAW_TAILWIND_PALETTE,
  },
]

/** Files that legitimately hold raw colors, each with the reason it is outside the rule. */
export const COLOR_LINT_ALLOWLIST: ReadonlyMap<string, string> = new Map([
  ['src/styles/palette.css', 'the palette itself'],
  ['src/styles/syntax-colors.css', 'syntax highlighting and git-diff colors are out of scope for TOL-406'],
  ['src/utils/releaseHistoryPage.ts', 'public website release page, not the desktop app'],
  ['src/utils/releaseDownloadPage.ts', 'public website download page, not the desktop app'],
  ['src/utils/sheetIronCalcColor.ts', 'IronCalc cell styles need hex values; mirrors palette steps (tested)'],
  ['src/utils/sheetSelectionChrome.ts', 'matches the colors the IronCalc engine paints, to restyle them'],
  ['src/utils/sheetEditorTextContrast.ts', 'matches the colors the IronCalc engine paints, to restyle them'],
  ['src/utils/sheetWorkbook.ts', 'IronCalc workbook default font color'],
  ['src/utils/colorUtils.ts', 'parses user-entered custom colors'],
  ['src/components/ColorInput.tsx', 'native color input needs a hex value'],
  ['src/lib/appIconTheme.ts', 'native window background needs hex; mirrors palette steps (tested)'],
  ['src/components/note-list/graph/graphPalette.ts', 'converts resolved theme tokens into WebGL rgba strings'],
  ['src/components/note-list/graph/graphRenderer.ts', 'WebGL shader defaults'],
  ['src/components/richEditorRecoveryClassifier.ts', 'matches React error 185 by its hash-prefixed code, not a color'],
  ['src/utils/sheetWikilinkModelBridge.ts', 'IronCalc cell font color needs hex; the brand blue 600'],
  ['src/utils/openAiWorkspaceWindow.ts', 'native transparent window background needs a hex value'],
])

const LINTED_EXTENSIONS = /\.(?:css|ts|tsx)$/
const TEST_FILE = /(?:\.test\.|\.spec\.|testUtils|\/test\/|\/test-utils\/)/

export function isColorLintTarget(path: string): boolean {
  return LINTED_EXTENSIONS.test(path) && !TEST_FILE.test(path) && !COLOR_LINT_ALLOWLIST.has(path)
}

function isTextSizeModifier(rule: ColorRuleId, match: string): boolean {
  return rule === 'tailwind-opacity-modifier' && TEXT_SIZE_UTILITY.test(match)
}

function lineViolations(path: string, text: string, line: number): ColorViolation[] {
  return COLOR_RULES.flatMap(({ id, pattern }) =>
    Array.from(text.matchAll(pattern), (found) => found[0])
      .filter((match) => !isTextSizeModifier(id, match))
      .map((match) => ({ path, line, rule: id, match })),
  )
}

export function findColorViolations(path: string, source: string): ColorViolation[] {
  return source.split('\n').flatMap((text, index) => lineViolations(path, text, index + 1))
}

export function formatColorViolation(violation: ColorViolation): string {
  return `${violation.path}:${violation.line}  ${violation.rule}  ${violation.match}`
}
