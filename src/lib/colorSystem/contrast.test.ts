import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildContrastReport, contrastRatio, formatContrastReport, resolveToken, themeTokens } from './contrast'

// Vitest stubs CSS imports, so the theme files are read from disk (paths relative to the repo root).
const sources = [readFileSync('src/styles/palette.css', 'utf8'), readFileSync('src/index.css', 'utf8')]

const FIXTURE = `
:root { --white: #FFFFFF; --ink: #111111; --blue: #155DFF; }
:root,
[data-theme="light"] { --surface: var(--white); --text: var(--ink); }
:root.dark,
[data-theme="dark"] { --surface: var(--ink); --text: var(--white); }
:root, [data-theme="light"], :root.dark, [data-theme="dark"] { --fill: var(--blue); --on-fill: var(--white); --broken: var(--missing); }
`

describe('token contrast', () => {
  it('computes WCAG ratios', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 5)
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5)
    expect(contrastRatio('#155DFF', '#FFFFFF')).toBeCloseTo(contrastRatio('#FFFFFF', '#155DFF'), 5)
  })

  it('resolves each theme through shared aliases to palette hex values', () => {
    const light = themeTokens([FIXTURE], 'light')
    const dark = themeTokens([FIXTURE], 'dark')
    expect(resolveToken(light, '--text')).toBe('#111111')
    expect(resolveToken(dark, '--text')).toBe('#FFFFFF')
    expect(resolveToken(dark, '--fill')).toBe('#155DFF')
    expect(resolveToken(light, '--broken')).toBeNull()
    expect(resolveToken(light, '--unknown')).toBeNull()
  })

  it('fails a pairing whose tokens do not resolve or miss the floor', () => {
    const report = buildContrastReport([FIXTURE], [
      { label: 'text', foreground: '--text', background: '--surface', minimum: 4.5 },
      { label: 'broken', foreground: '--broken', background: '--surface', minimum: 3 },
      { label: 'same', foreground: '--surface', background: '--surface', minimum: 3 },
    ])
    expect(report.map((result) => `${result.theme} ${result.label} ${result.pass}`)).toEqual([
      'light text true', 'light broken false', 'light same false',
      'dark text true', 'dark broken false', 'dark same false',
    ])
    expect(formatContrastReport(report)).toContain('2/6 checks pass.')
  })

  it('meets every TOL-406 contrast promise in light and dark', () => {
    const failures = buildContrastReport(sources)
      .filter((result) => !result.pass)
      .map((result) => `${result.theme}: ${result.label} ${result.ratio.toFixed(2)}`)
    expect(failures).toEqual([])
  })

  it('keeps white text on the primary and destructive fills in both themes', () => {
    for (const theme of ['light', 'dark'] as const) {
      const tokens = themeTokens(sources, theme)
      expect(resolveToken(tokens, '--primary-foreground')).toBe('#FFFFFF')
      expect(resolveToken(tokens, '--destructive-foreground')).toBe('#FFFFFF')
      expect(resolveToken(tokens, '--primary')).toBe('#155DFF')
    }
  })

  it('keeps the count pill fill unchanged so it blends into a hovered row', () => {
    for (const theme of ['light', 'dark'] as const) {
      const tokens = themeTokens(sources, theme)
      expect(resolveToken(tokens, '--count-pill-bg')).toBe(resolveToken(tokens, '--state-hover'))
      expect(resolveToken(tokens, '--count-pill-bg-hover')).toBe(resolveToken(tokens, '--count-pill-bg'))
    }
  })

  it('keeps sidebar hover and gray row fills visible on the sidebar surface', () => {
    for (const theme of ['light', 'dark'] as const) {
      const tokens = themeTokens(sources, theme)
      const sidebar = resolveToken(tokens, '--surface-sidebar') ?? ''
      for (const fill of ['--sidebar-hover', '--sidebar-gray-fill']) {
        expect(contrastRatio(resolveToken(tokens, fill) ?? sidebar, sidebar), `${theme} ${fill}`).toBeGreaterThanOrEqual(1.1)
      }
    }
  })

  it('keeps the approved legacy brand colors on the palette scale', () => {
    const anchors = {
      red: '#E53E3E', orange: '#D9730D', yellow: '#D69E2E', green: '#38A169',
      blue: '#155DFF', purple: '#805AD5', teal: '#319795', pink: '#D53F8C',
    }
    const tokens = themeTokens(sources, 'light')
    for (const [hue, hex] of Object.entries(anchors)) {
      expect(resolveToken(tokens, `--${hue}-500`)).toBe(hex)
    }
  })

  it('keeps dark chip labels readable on tinted fills', () => {
    const report = buildContrastReport(sources).filter(
      (result) => result.theme === 'dark' && result.label.endsWith('chip label'),
    )
    expect(report.length).toBeGreaterThan(0)
    for (const pair of report) {
      expect(pair.ratio, pair.label).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('keeps yellow icons above 3:1 on the light hover surface', () => {
    const yellowRows = buildContrastReport(sources).filter((result) => result.label === 'yellow icon')
    const lightHover = yellowRows.find((result) => result.theme === 'light' && result.background === '--state-hover')
    const darkHover = yellowRows.find((result) => result.theme === 'dark' && result.background === '--state-hover')
    expect(lightHover?.minimum).toBe(2.1)
    expect(lightHover?.ratio).toBeGreaterThanOrEqual(3)
    expect(darkHover?.minimum).toBe(3)
    expect(darkHover?.pass).toBe(true)
  })
})
