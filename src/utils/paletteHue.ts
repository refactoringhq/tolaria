import { toHexColor } from './colorUtils'

/**
 * Snaps an arbitrary CSS color (a custom vault color) to the nearest hue in
 * the Tolaria palette, so custom colors render with the same chip, icon and
 * fill steps as the named hues (TOL-406).
 */
export type PaletteHueKey = 'red' | 'orange' | 'yellow' | 'green' | 'teal' | 'blue' | 'purple' | 'pink' | 'gray'

/** HSL hue angle of each palette hue's 600 step. */
const PALETTE_HUE_ANGLES: [PaletteHueKey, number][] = [
  ['red', 356],
  ['orange', 30],
  ['yellow', 42],
  ['green', 154],
  ['teal', 180],
  ['blue', 221],
  ['purple', 263],
  ['pink', 325],
]
const GRAY_SATURATION = 0.15

interface HueAndSaturation {
  hue: number
  saturation: number
}

function rgbChannels(hex: string): number[] {
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
}

function hueOf(channels: number[], max: number, delta: number): number {
  const [red, green, blue] = channels
  if (max === red) return (60 * ((green - blue) / delta) + 360) % 360
  if (max === green) return 60 * ((blue - red) / delta) + 120
  return 60 * ((red - green) / delta) + 240
}

function hueAndSaturation(hex: string): HueAndSaturation {
  const channels = rgbChannels(hex)
  const max = Math.max(...channels)
  const min = Math.min(...channels)
  const delta = max - min
  if (delta === 0) return { hue: 0, saturation: 0 }
  const lightness = (max + min) / 2
  const saturation = delta / (1 - Math.abs(2 * lightness - 1))
  return { hue: hueOf(channels, max, delta), saturation }
}

function hueDistance(first: number, second: number): number {
  const difference = Math.abs(first - second) % 360
  return Math.min(difference, 360 - difference)
}

export function nearestPaletteHue(color: string): PaletteHueKey {
  const hex = toHexColor(color)
  if (!hex) return 'gray'
  const { hue, saturation } = hueAndSaturation(hex)
  if (saturation < GRAY_SATURATION) return 'gray'
  const [nearest] = [...PALETTE_HUE_ANGLES].sort(
    ([, first], [, second]) => hueDistance(hue, first) - hueDistance(hue, second),
  )
  return nearest[0]
}
