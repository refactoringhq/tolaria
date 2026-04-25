import { describe, it, expect, vi } from 'vitest'
import {
  normalizeLanguage,
  detectLanguage,
  SUPPORTED_LANGUAGES,
  writeLanguageToStorage,
} from '../settings'

describe('normalizeLanguage', () => {
  it('returns null for non-string values', () => {
    expect(normalizeLanguage(null)).toBeNull()
    expect(normalizeLanguage(undefined)).toBeNull()
    expect(normalizeLanguage(42)).toBeNull()
  })

  it('returns null for unsupported languages', () => {
    expect(normalizeLanguage('fr')).toBeNull()
    expect(normalizeLanguage('de')).toBeNull()
    expect(normalizeLanguage('ko')).toBeNull()
    expect(normalizeLanguage('')).toBeNull()
  })

  it('normalizes valid languages', () => {
    expect(normalizeLanguage('en')).toBe('en')
    expect(normalizeLanguage('zh-CN')).toBe('zh-CN')
    expect(normalizeLanguage('ja')).toBe('ja')
  })

  it('handles case variations', () => {
    expect(normalizeLanguage('EN')).toBe('en')
    expect(normalizeLanguage('ZH-CN')).toBe('zh-CN')
    expect(normalizeLanguage('JA')).toBe('ja')
  })

  it('handles zh-cn -> zh-CN normalization', () => {
    expect(normalizeLanguage('zh-cn')).toBe('zh-CN')
    expect(normalizeLanguage('zh_cn')).toBe('zh-CN')
    expect(normalizeLanguage('zh-Hans')).toBe('zh-CN')
  })

  it('handles en-US -> en normalization', () => {
    expect(normalizeLanguage('en-US')).toBe('en')
    expect(normalizeLanguage('en-GB')).toBe('en')
  })

  it('handles ja-JP -> ja normalization', () => {
    expect(normalizeLanguage('ja-JP')).toBe('ja')
  })

  it('trims whitespace', () => {
    expect(normalizeLanguage('  en  ')).toBe('en')
  })
})

describe('detectLanguage', () => {
  it('returns language from Rust settings when available', () => {
    const storage = { getItem: vi.fn() }
    expect(detectLanguage('zh-CN', storage)).toBe('zh-CN')
    expect(detectLanguage('ja', storage)).toBe('ja')
    expect(detectLanguage('en', storage)).toBe('en')
  })

  it('falls back to localStorage when Rust settings is null', () => {
    const storage = { getItem: vi.fn().mockReturnValue('ja') }
    expect(detectLanguage(null, storage)).toBe('ja')
  })

  it('falls back to navigator.language when no stored preference', () => {
    const storage = { getItem: vi.fn().mockReturnValue(null) }
    expect(detectLanguage(null, storage, 'zh-CN')).toBe('zh-CN')
    expect(detectLanguage(null, storage, 'zh-Hans-CN')).toBe('zh-CN')
    expect(detectLanguage(null, storage, 'ja-JP')).toBe('ja')
  })

  it('returns en for non-matching navigator language', () => {
    const storage = { getItem: vi.fn().mockReturnValue(null) }
    expect(detectLanguage(null, storage, 'fr-FR')).toBe('en')
  })

  it('returns en when all sources are empty', () => {
    const storage = { getItem: vi.fn().mockReturnValue(null) }
    expect(detectLanguage(null, storage)).toBe('en')
  })

  it('handles invalid localStorage value gracefully', () => {
    const storage = { getItem: vi.fn().mockReturnValue('invalid') }
    expect(detectLanguage(null, storage)).toBe('en')
  })
})

describe('writeLanguageToStorage', () => {
  it('writes language to storage', () => {
    const storage = { setItem: vi.fn() }
    writeLanguageToStorage(storage, 'zh-CN')
    expect(storage.setItem).toHaveBeenCalledWith('tolaria-language', 'zh-CN')
  })

  it('handles storage errors gracefully', () => {
    const storage = { setItem: vi.fn().mockImplementation(() => { throw new Error('quota') }) }
    expect(() => writeLanguageToStorage(storage, 'ja')).not.toThrow()
  })
})

describe('SUPPORTED_LANGUAGES', () => {
  it('contains en, zh-CN, ja', () => {
    expect(SUPPORTED_LANGUAGES).toEqual(['en', 'zh-CN', 'ja'])
  })
})
