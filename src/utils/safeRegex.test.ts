import { describe, expect, it } from 'vitest'

import { compileSafeUserRegex } from './safeRegex'

describe('compileSafeUserRegex', () => {
  it('compiles valid patterns with the requested flags', () => {
    const result = compileSafeUserRegex('^tolaria$', 'i')

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.pattern.flags).toContain('i')
    expect(result.pattern.test('Tolaria')).toBe(true)
    expect(result.pattern.test('Laputa')).toBe(false)
  })

  it('rejects invalid regular expression syntax', () => {
    expect(compileSafeUserRegex('(')).toEqual({ ok: false, reason: 'invalid' })
  })

  it('rejects sources longer than 256 characters while accepting the boundary', () => {
    const boundaryResult = compileSafeUserRegex('a'.repeat(256))

    expect(boundaryResult.ok).toBe(true)
    expect(compileSafeUserRegex('a'.repeat(257))).toEqual({ ok: false, reason: 'too_long' })
  })

  it('rejects patterns vulnerable to catastrophic backtracking', () => {
    expect(compileSafeUserRegex('(a+)+$')).toEqual({ ok: false, reason: 'unsafe' })
  })
})
