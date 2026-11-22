import { describe, expect, it } from 'vitest'
import { hexHslComponents, nativewindPalettes } from './nativewindPalette'

describe('NativeWind semantic palette', () => {
  it('uses the same desktop palette for RNR classes', () => {
    expect(nativewindPalettes.light['--background']).toBe('0 0% 100%')
    expect(nativewindPalettes.dark['--background']).toBe(hexHslComponents('#25231F'))
    expect(nativewindPalettes.dark['--foreground']).toBe(hexHslComponents('#E1DFDB'))
    expect(nativewindPalettes.dark['--primary']).toBe(hexHslComponents('#155DFF'))
    expect(nativewindPalettes.dark['--radius']).toBe('0.5rem')
  })

  it('converts RGB extrema and neutral tones without losing saturation', () => {
    expect(hexHslComponents('#000000')).toBe('0 0% 0%')
    expect(hexHslComponents('#ff0000')).toBe('0 100% 50%')
    expect(hexHslComponents('#00ff00')).toBe('120 100% 50%')
    expect(hexHslComponents('#0000ff')).toBe('240 100% 50%')
    expect(hexHslComponents('#ff00ff')).toBe('300 100% 50%')
    expect(() => hexHslComponents('invalid')).toThrow('Expected a six-digit desktop color')
  })
})
