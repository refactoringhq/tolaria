import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { APP_STORAGE_KEYS } from '../constants/appStorage'
import { getThemeById } from './appThemes'
import {
  applyAppearanceToDocument,
  readStoredAppearancePreferences,
  resolveAppearanceMode,
  writeStoredAppearancePreferences,
} from './appearance'

describe('appearance preferences', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
    delete document.documentElement.dataset.appearance
    delete document.documentElement.dataset.themeId
    delete document.documentElement.dataset.surfaceMode
    document.documentElement.style.colorScheme = ''
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('defaults to the graphite sapphire glass theme when storage is empty', () => {
    expect(readStoredAppearancePreferences()).toEqual({
      themeId: 'graphiteSapphire',
      surfaceMode: 'glass',
    })
  })

  it('reads legacy string appearance values from storage', () => {
    localStorage.setItem(APP_STORAGE_KEYS.theme, '"dark"')

    expect(readStoredAppearancePreferences()).toEqual({
      themeId: 'graphiteSapphire',
      surfaceMode: 'glass',
    })
  })

  it('writes structured appearance preferences to storage', () => {
    writeStoredAppearancePreferences({
      themeId: 'obsidianAurora',
      surfaceMode: 'solid',
    })

    expect(localStorage.getItem(APP_STORAGE_KEYS.theme)).toBe(
      JSON.stringify({ themeId: 'obsidianAurora', surfaceMode: 'solid' }),
    )
  })

  it('resolves appearance from the selected theme', () => {
    expect(resolveAppearanceMode('graphiteSapphire')).toBe('dark')
    expect(resolveAppearanceMode('tolariaDawn')).toBe('light')
  })

  it('applies appearance metadata to the document root', () => {
    applyAppearanceToDocument(
      {
        themeId: 'graphiteSapphire',
        surfaceMode: 'glass',
      },
      'dark',
    )

    expect(document.documentElement.dataset.appearance).toBe('dark')
    expect(document.documentElement.dataset.themeId).toBe('graphiteSapphire')
    expect(document.documentElement.dataset.surfaceMode).toBe('glass')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.style.colorScheme).toBe('dark')
    expect(document.documentElement.style.getPropertyValue('--theme-accent-primary')).toBe(
      getThemeById('graphiteSapphire').tokens.accentPrimary,
    )
  })
})
