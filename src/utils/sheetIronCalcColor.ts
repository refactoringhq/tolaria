import { expandShortHex, toHexColor } from './colorUtils'

const HEX3_RE = /^#[0-9a-f]{3}$/i
const HEX6_RE = /^#[0-9a-f]{6}$/i
const HEX8_RE = /^#[0-9a-f]{8}$/i
const CSS_VARIABLE_RE = /^var\(\s*(--[\w-]+)\s*\)$/i
const RGB_COLOR_RE = /^rgba?\(([^)]*)\)$/i

const SHEET_COLOR_ALIASES = new Map<string, string>([
  ['black', '#000000'],
  ['white', '#ffffff'],
  ['red', '#cb1222'],
  ['orange', '#a55501'],
  ['yellow', '#8e6503'],
  ['green', '#01824c'],
  ['blue', '#155dff'],
  ['purple', '#7a42dd'],
  ['teal', '#037d7c'],
  ['pink', '#bf1677'],
  ['gray', '#6e6b66'],
  ['grey', '#6e6b66'],
  ['violet', '#ee82ee'],
  ['--accent-red', '#cb1222'],
  ['--accent-red-light', '#cb1222'],
  ['--accent-orange', '#a55501'],
  ['--accent-orange-light', '#a55501'],
  ['--accent-yellow', '#8e6503'],
  ['--accent-yellow-light', '#8e6503'],
  ['--accent-green', '#01824c'],
  ['--accent-green-light', '#01824c'],
  ['--accent-blue', '#155dff'],
  ['--accent-blue-bg', '#155dff'],
  ['--accent-blue-hover', '#0041d3'],
  ['--accent-blue-light', '#155dff'],
  ['--accent-purple', '#7a42dd'],
  ['--accent-purple-light', '#7a42dd'],
  ['--accent-teal', '#037d7c'],
  ['--accent-teal-light', '#037d7c'],
  ['--accent-pink', '#bf1677'],
  ['--accent-pink-light', '#bf1677'],
  ['--accent-gray', '#6e6b66'],
  ['--accent-gray-light', '#6e6b66'],
])

function colorAlias(value: string): string {
  const match = CSS_VARIABLE_RE.exec(value)
  return (match?.[1] ?? value).toLowerCase()
}

function rgbComponentToHex(componentText: string): string | null {
  const component = Number(componentText)
  if (!Number.isInteger(component) || component < 0 || component > 255) return null
  return component.toString(16).padStart(2, '0')
}

function validAlpha(parts: string[]): boolean {
  const alpha = parts.at(3)
  if (alpha === undefined) return true
  const alphaValue = Number(alpha)
  return Number.isFinite(alphaValue) && alphaValue >= 0 && alphaValue <= 1
}

function rgbParts(value: string): string[] | null {
  const body = RGB_COLOR_RE.exec(value)?.at(1)
  if (body === undefined) return null
  const parts = body.split(',').map(part => part.trim())
  if (parts.length !== 3 && parts.length !== 4) return null
  if (!validAlpha(parts)) return null
  return parts
}

function rgbColorToHex(value: string): string | null {
  const parts = rgbParts(value)
  if (!parts) return null
  const components = parts.slice(0, 3).map(rgbComponentToHex)
  if (!components.every((component): component is string => component !== null)) return null

  return `#${components.join('')}`
}

export function normalizeSheetColorForIronCalc(value: string | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  if (HEX6_RE.test(trimmed)) return trimmed.toLowerCase()
  if (HEX3_RE.test(trimmed)) return expandShortHex(trimmed).toLowerCase()
  if (HEX8_RE.test(trimmed)) return trimmed.slice(0, 7).toLowerCase()

  const mapped = SHEET_COLOR_ALIASES.get(colorAlias(trimmed))
  if (mapped) return mapped

  return rgbColorToHex(trimmed) ?? toHexColor(trimmed)
}
