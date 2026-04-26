import { afterEach, describe, expect, it, vi } from 'vitest'
import { normalizeExternalUrl, openExternalUrl } from './url'

describe('normalizeExternalUrl', () => {
  it('keeps valid http URLs and normalizes bare domains', () => {
    expect(normalizeExternalUrl('https://example.com/docs')).toBe('https://example.com/docs')
    expect(normalizeExternalUrl('example.com/docs')).toBe('https://example.com/docs')
  })

  it('rejects malformed or unsupported URLs', () => {
    expect(normalizeExternalUrl('https://exa mple.com')).toBeNull()
    expect(normalizeExternalUrl('javascript:alert(1)')).toBeNull()
    expect(normalizeExternalUrl('not a url')).toBeNull()
  })
})

describe('openExternalUrl', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not ask the browser to open malformed URLs', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)

    await openExternalUrl('https://exa mple.com')

    expect(open).not.toHaveBeenCalled()
  })
})
