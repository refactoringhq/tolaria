import { describe, expect, it } from 'vitest'
import { errorMessage, errorMessageIncludes } from './vaultErrors'

describe('errorMessage', () => {
  it.each([
    [new Error('boom'), 'boom'],
    ['failed', 'failed'],
    [{ message: 'bridge failed' }, 'bridge failed'],
    [42, '42'],
    [undefined, 'undefined'],
  ])('extracts a stable message from %o', (error, expected) => {
    expect(errorMessage(error)).toBe(expected)
  })

  it('uses an explicit fallback for values without a message', () => {
    expect(errorMessage({ code: 500 }, '')).toBe('')
  })

  it.each([
    [new Error('editor view is unavailable'), true],
    ['editor view is unavailable', true],
    [{ message: 'editor view is unavailable' }, true],
    [{ code: 500 }, false],
  ])('matches known message fragments in %o', (error, expected) => {
    expect(errorMessageIncludes(error, 'editor view', 'unavailable')).toBe(expected)
  })
})
