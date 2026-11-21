import { getAppStorageItem } from '../constants/appStorage'
import { ACCENT_COLORS } from './typeColors'
import { updateVaultConfigField } from './vaultConfigStore'

export interface TagStyle {
  bg: string
  color: string
}

export const DEFAULT_TAG_STYLE: TagStyle = {
  bg: 'var(--accent-blue-light)',
  color: 'var(--accent-blue-text)',
}

/** Deterministic hash → accent color index for tags without a manual override. */
function hashTagColor(tag: string): TagStyle {
  let hash = 0
  for (let i = 0; i < tag.length; i++) {
    hash = ((hash << 5) - hash + tag.charCodeAt(i)) | 0
  }
  const idx = ((hash % ACCENT_COLORS.length) + ACCENT_COLORS.length) % ACCENT_COLORS.length
  const accent = ACCENT_COLORS.at(idx) ?? ACCENT_COLORS[0]
  return { bg: accent.cssLight, color: accent.cssText }
}

const COLOR_KEY_TO_STYLE: Record<string, TagStyle> = Object.fromEntries(
  ACCENT_COLORS.map(c => [c.key, { bg: c.cssLight, color: c.cssText }]),
)
const COLOR_KEY_STYLE_LOOKUP = new Map(Object.entries(COLOR_KEY_TO_STYLE))

let colorOverrides: Record<string, string> = loadColorOverrides()

/** Initialize tag color overrides from vault config (replaces localStorage). */
export function initTagColors(overrides: Record<string, string>): void {
  colorOverrides = { ...overrides }
}

function loadColorOverrides(): Record<string, string> {
  const raw = getAppStorageItem('tagColors')
  if (!raw) return {}
  try {
    return JSON.parse(raw) as Record<string, string>
  } catch {
    return {}
  }
}

export function setTagColor(tag: string, colorKey: string | null): void {
  if (colorKey === null) {
    Reflect.deleteProperty(colorOverrides, tag)
  } else {
    Reflect.set(colorOverrides, tag, colorKey)
  }
  const snapshot = { ...colorOverrides }
  updateVaultConfigField('tag_colors', Object.keys(snapshot).length > 0 ? snapshot : null)
}

export function getTagColorKey(tag: string): string | null {
  return (Reflect.get(colorOverrides, tag) as string | undefined) ?? null
}

export function getTagStyle(tag: string): TagStyle {
  const overrideKey = Reflect.get(colorOverrides, tag) as string | undefined
  if (overrideKey) {
    const style = COLOR_KEY_STYLE_LOOKUP.get(overrideKey)
    if (style) return style
  }
  return hashTagColor(tag)
}
