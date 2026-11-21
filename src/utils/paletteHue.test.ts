import { describe, expect, it } from 'vitest'
import { nearestPaletteHue } from './paletteHue'

describe('nearestPaletteHue', () => {
  it('snaps saturated colors to the nearest palette hue', () => {
    expect(nearestPaletteHue('#e53e3e')).toBe('red')
    expect(nearestPaletteHue('#f97316')).toBe('orange')
    expect(nearestPaletteHue('#eab308')).toBe('yellow')
    expect(nearestPaletteHue('#22c55e')).toBe('green')
    expect(nearestPaletteHue('#22d3ee')).toBe('teal')
    expect(nearestPaletteHue('#3b82f6')).toBe('blue')
    expect(nearestPaletteHue('#8b5cf6')).toBe('purple')
    expect(nearestPaletteHue('#ec4899')).toBe('pink')
    expect(nearestPaletteHue('#f0f')).toBe('pink')
  })

  it('treats near-neutral and unparseable colors as gray', () => {
    expect(nearestPaletteHue('#718096')).toBe('gray')
    expect(nearestPaletteHue('#808080')).toBe('gray')
    expect(nearestPaletteHue('#000000')).toBe('gray')
    expect(nearestPaletteHue('not-a-color')).toBe('gray')
  })
})
