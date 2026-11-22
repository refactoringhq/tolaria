import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { mobileColors } from '../tokens'
import generatedThemes from './desktopThemes.generated.json'
import { mobilePalettes, resolveMobileTheme } from './mobilePalette'
import { parseDesktopThemes, readDesktopThemeCss } from './parseDesktopTheme'

describe('mobile palette contract', () => {
  it('keeps generated tokens identical to desktop CSS', () => {
    expect(generatedThemes).toEqual(parseDesktopThemes(readDesktopThemeCss((path) => readFileSync(`../../${path}`, 'utf8'))))
  })

  it('preserves existing light roles and provides every role in dark mode', () => {
    expect(mobilePalettes.light).toMatchObject(mobileColors)
    expect(Object.keys(mobilePalettes.dark)).toEqual(Object.keys(mobilePalettes.light))
    expect(mobilePalettes.dark.text).toBe('#E1DFDB')
    expect(mobilePalettes.dark.editor).toBe('#25231F')
    expect(mobilePalettes.dark.sidebar).toBe('#191713')
    expect(mobilePalettes.dark.primary).toBe('#7EA9FF')
    expect(mobilePalettes.dark.textInverse).toBe('#191713')
  })

  it('uses system appearance only when requested, defaulting to light without a system value', () => {
    expect(resolveMobileTheme('system', 'dark')).toBe('dark')
    expect(resolveMobileTheme('light', 'dark')).toBe('light')
    expect(resolveMobileTheme('dark', 'light')).toBe('dark')
    expect(resolveMobileTheme('system', null)).toBe('light')
  })
})
