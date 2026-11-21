import { describe, expect, it } from 'vitest'
import { normalizeSheetColorForIronCalc } from './sheetIronCalcColor'

describe('normalizeSheetColorForIronCalc', () => {
  it('maps Tolaria and CSS color values to IronCalc-safe hex colors', () => {
    expect(normalizeSheetColorForIronCalc('violet')).toBe('#ee82ee')
    expect(normalizeSheetColorForIronCalc('var(--accent-purple)')).toBe('#7a42dd')
    expect(normalizeSheetColorForIronCalc('rgba(128, 90, 213, 0.1)')).toBe('#805ad5')
    expect(normalizeSheetColorForIronCalc('#abc')).toBe('#aabbcc')
    expect(normalizeSheetColorForIronCalc('#11223344')).toBe('#112233')
  })

  it('rejects values that cannot be safely converted for IronCalc', () => {
    expect(normalizeSheetColorForIronCalc('not-a-color')).toBeNull()
    expect(normalizeSheetColorForIronCalc(undefined)).toBeNull()
  })
})
