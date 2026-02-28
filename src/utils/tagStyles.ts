import { ACCENT_COLORS } from './typeColors'

export interface TagStyle {
  bg: string
  color: string
}

export const DEFAULT_TAG_STYLE: TagStyle = {
  bg: 'var(--accent-blue-light)',
  color: 'var(--accent-blue)',
}

const STORAGE_KEY = 'laputa:tag-color-overrides'

const COLOR_KEY_TO_STYLE: Record<string, TagStyle> = Object.fromEntries(
  ACCENT_COLORS.map(c => [c.key, { bg: c.cssLight, color: c.css }]),
)

const colorOverrides: Record<string, string> = loadColorOverrides()

function loadColorOverrides(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch {
    return {}
  }
}

export function setTagColor(tag: string, colorKey: string | null): void {
  if (colorKey === null) {
    delete colorOverrides[tag]
  } else {
    colorOverrides[tag] = colorKey
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(colorOverrides))
  } catch { /* storage full — silently ignore */ }
}

export function getTagColorKey(tag: string): string | null {
  return colorOverrides[tag] ?? null
}

export function getTagStyle(tag: string): TagStyle {
  const overrideKey = colorOverrides[tag]
  if (overrideKey) {
    const style = COLOR_KEY_TO_STYLE[overrideKey]
    if (style) return style
  }
  return DEFAULT_TAG_STYLE
}
