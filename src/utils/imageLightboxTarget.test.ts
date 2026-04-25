import { describe, expect, it } from 'vitest'
import { getDoubleClickedImageSrc } from './imageLightboxTarget'

describe('getDoubleClickedImageSrc', () => {
  it('returns the src when the target is an image element with a src', () => {
    const img = document.createElement('img')
    img.src = 'https://example.com/cat.png'

    expect(getDoubleClickedImageSrc(img)).toBe('https://example.com/cat.png')
  })

  it('returns null when the target is an image element without a src', () => {
    const img = document.createElement('img')

    expect(getDoubleClickedImageSrc(img)).toBeNull()
  })

  it('returns null when the target is not an image element', () => {
    const div = document.createElement('div')

    expect(getDoubleClickedImageSrc(div)).toBeNull()
  })

  it('returns null when the target is null', () => {
    expect(getDoubleClickedImageSrc(null)).toBeNull()
  })

  it('ignores tracking pixel images smaller than the visibility threshold', () => {
    const img = document.createElement('img')
    img.src = 'https://example.com/pixel.gif'
    Object.defineProperty(img, 'naturalWidth', { value: 1, configurable: true })
    Object.defineProperty(img, 'naturalHeight', { value: 1, configurable: true })

    expect(getDoubleClickedImageSrc(img)).toBeNull()
  })
})
