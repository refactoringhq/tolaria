import { describe, expect, it } from 'vitest'
import { normalizeUiLocale, translate } from './i18n'

describe('i18n', () => {
  it('normalizes supported locales', () => {
    expect(normalizeUiLocale('en')).toBe('en')
    expect(normalizeUiLocale('zh')).toBe('zh-CN')
    expect(normalizeUiLocale('zh-CN')).toBe('zh-CN')
  })

  it('translates known messages with params', () => {
    expect(translate('{count} files changed', { count: 3 }, 'zh-CN')).toBe('3 个文件已更改')
  })

  it('falls back to source message for english', () => {
    expect(translate('Save', undefined, 'en')).toBe('Save')
  })
})
