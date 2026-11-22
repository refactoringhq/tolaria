import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseDesktopThemes, readDesktopThemeCss } from './parseDesktopTheme'

const desktopCss = () => readDesktopThemeCss((path) => readFileSync(`../../${path}`, 'utf8'))

describe('desktop theme export', () => {
  it('extracts both desktop palettes and resolves semantic aliases', () => {
    const themes = parseDesktopThemes(desktopCss())
    expect(themes.light['--background']).toBe('#FFFFFF')
    expect(themes.dark['--background']).toBe('#25231F')
    expect(themes.dark['--sidebar']).toBe('#191713')
    expect(themes.dark['--foreground']).toBe('#E1DFDB')
    expect(themes.dark['--primary-foreground']).toBe('#FFFFFF')
    expect(Object.keys(themes.dark).sort()).toEqual(Object.keys(themes.light).sort())
    expect(Object.values(themes.dark).some((value) => value.includes('var('))).toBe(false)
  })

  it('resolves semantic roles through the shared :root palette in both themes', () => {
    const sheet = `:root { --gray-50: #F8F7F4; --gray-950: #191713; }
      :root, [data-theme="light"] { --background: var(--gray-50); }
      [data-theme="dark"] { --background: var(--gray-950); }`
    const themes = parseDesktopThemes(sheet)
    expect(themes.light['--background']).toBe('#F8F7F4')
    expect(themes.dark['--background']).toBe('#191713')
    expect(themes.dark['--gray-50']).toBe('#F8F7F4')
  })

  it('inlines local stylesheet imports and leaves package imports alone', () => {
    const files: Record<string, string> = {
      'src/index.css': '@import "tailwindcss";\n@import "./styles/palette.css";\n[data-theme="light"] {}',
      'src/styles/palette.css': ':root { --white: #FFFFFF; }',
    }
    expect(readDesktopThemeCss((path) => files[path])).toBe(
      '@import "tailwindcss";\n:root { --white: #FFFFFF; }\n[data-theme="light"] {}',
    )
  })

  it('rejects incomplete palettes instead of silently exporting light-only tokens', () => {
    expect(() => parseDesktopThemes('[data-theme="light"] { --background: white; }')).toThrow('Missing desktop dark theme')
  })

  it('rejects missing aliases and cycles', () => {
    const sheet = (value: string) => `[data-theme="light"] { --a: ${value}; } [data-theme="dark"] { --a: black; }`
    expect(() => parseDesktopThemes(sheet('var(--missing)'))).toThrow('Missing theme variable --missing')
    expect(() => parseDesktopThemes(sheet('var(--a)'))).toThrow('Cyclic theme variable --a')
  })

  it('resolves repeated aliases inside CSS functions and rejects nested cycles', () => {
    const sheet = (value: string) => `[data-theme="light"] { --base: white; --a: ${value}; }
      [data-theme="dark"] { --base: black; }`
    const themes = parseDesktopThemes(sheet('color-mix(in srgb, var(--base) 50%, var( --base ))'))
    expect(themes.light['--a']).toBe('color-mix(in srgb, white 50%, white)')
    expect(themes.dark['--a']).toBe('color-mix(in srgb, black 50%, black)')
    expect(() => parseDesktopThemes(sheet('color-mix(in srgb, var(--a), transparent)')))
      .toThrow('Cyclic theme variable --a')
    expect(() => parseDesktopThemes(sheet('color-mix(in srgb, var(--missing), transparent)')))
      .toThrow('Missing theme variable --missing')
  })
})
