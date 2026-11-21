/**
 * Maps note types to their accent color CSS variables.
 * Single source of truth for type→color mapping used across Sidebar, NoteList, and Inspector.
 */

import type { VaultEntry } from '../types'
import { isValidCssColor } from './colorUtils'
import { nearestPaletteHue } from './paletteHue'
import { WORKSPACE_COLORS } from './workspaceColors'

/** Builds a map from type name → Type document entry (for custom color/icon lookup).
 *  Stores both original title and lowercase version so lookups work regardless
 *  of whether instances use `isA: Config` or `isA: config`. */
export function buildTypeEntryMap(entries: VaultEntry[]): Record<string, VaultEntry> {
  const map: Record<string, VaultEntry> = {}
  for (const e of entries) {
    if (e.isA === 'Type') {
      Reflect.set(map, e.title, e)
      const lower = e.title.toLowerCase()
      if (lower !== e.title) Reflect.set(map, lower, e)
    }
  }
  return map
}

/** Built-in type → palette hue. Custom Type colors override these. */
const TYPE_HUE_MAP: Record<string, string> = {
  Project: 'red',
  Experiment: 'red',
  Responsibility: 'purple',
  Procedure: 'purple',
  Person: 'yellow',
  Event: 'yellow',
  Topic: 'green',
  Type: 'blue',
}

const DEFAULT_HUE = 'gray'

/** Color key → CSS variable mapping for the design system accent palette */
export const ACCENT_COLORS: { key: string; label: string; css: string; cssLight: string; cssText: string }[] = [
  { key: 'red', label: 'Red', css: 'var(--accent-red)', cssLight: 'var(--accent-red-light)', cssText: 'var(--accent-red-text)' },
  { key: 'orange', label: 'Orange', css: 'var(--accent-orange)', cssLight: 'var(--accent-orange-light)', cssText: 'var(--accent-orange-text)' },
  { key: 'yellow', label: 'Yellow', css: 'var(--accent-yellow)', cssLight: 'var(--accent-yellow-light)', cssText: 'var(--accent-yellow-text)' },
  { key: 'green', label: 'Green', css: 'var(--accent-green)', cssLight: 'var(--accent-green-light)', cssText: 'var(--accent-green-text)' },
  { key: 'blue', label: 'Blue', css: 'var(--accent-blue)', cssLight: 'var(--accent-blue-light)', cssText: 'var(--accent-blue-text)' },
  { key: 'purple', label: 'Purple', css: 'var(--accent-purple)', cssLight: 'var(--accent-purple-light)', cssText: 'var(--accent-purple-text)' },
  { key: 'teal', label: 'Teal', css: 'var(--accent-teal)', cssLight: 'var(--accent-teal-light)', cssText: 'var(--accent-teal-text)' },
  { key: 'pink', label: 'Pink', css: 'var(--accent-pink)', cssLight: 'var(--accent-pink-light)', cssText: 'var(--accent-pink-text)' },
  { key: 'gray', label: 'Gray', css: 'var(--accent-gray)', cssLight: 'var(--accent-gray-light)', cssText: 'var(--accent-gray-text)' },
]

export const ACCENT_COLOR_PICKER_KEYS = WORKSPACE_COLORS
export const ACCENT_COLOR_PICKER_COLORS = ACCENT_COLOR_PICKER_KEYS
  .map((key) => ACCENT_COLORS.find((color) => color.key === key) ?? null)
  .filter((color): color is typeof ACCENT_COLORS[number] => color !== null)

type AccentColor = typeof ACCENT_COLORS[number]

const ACCENT_LOOKUP = new Map(ACCENT_COLORS.map((color) => [color.key, color]))
const TYPE_HUE_LOOKUP = new Map(Object.entries(TYPE_HUE_MAP))

/** Palette key for a custom color: a named hue, or a CSS color snapped to its nearest palette hue. */
function resolvePaletteKey(customColorKey?: string | null): string | null {
  const color = customColorKey?.trim()
  if (!color) return null

  const paletteKey = color.toLowerCase()
  if (ACCENT_LOOKUP.has(paletteKey)) return paletteKey
  return isValidCssColor(color) ? nearestPaletteHue(color) : null
}

function resolveTypeAccent(isA: string | null, customColorKey?: string | null): AccentColor {
  const hue = resolvePaletteKey(customColorKey) ?? (isA && TYPE_HUE_LOOKUP.get(isA)) ?? DEFAULT_HUE
  return ACCENT_LOOKUP.get(hue) ?? ACCENT_COLORS[ACCENT_COLORS.length - 1]
}

/** Icon/accent color of a note type, with optional custom override */
export function getTypeColor(isA: string | null, customColorKey?: string | null): string {
  return resolveTypeAccent(isA, customColorKey).css
}

/** Tinted fill (chips, active rows, calendar items) of a note type's color */
export function getTypeLightColor(isA: string | null, customColorKey?: string | null): string {
  return resolveTypeAccent(isA, customColorKey).cssLight
}

/** Label color for text sitting on the type's tinted fill */
export function getTypeTextColor(isA: string | null, customColorKey?: string | null): string {
  return resolveTypeAccent(isA, customColorKey).cssText
}

/** True when the type or its custom color picks a hue (an explicit gray counts) */
export function hasTypeHue(isA: string | null, customColorKey?: string | null): boolean {
  return resolveTypeAccent(isA, customColorKey).key !== DEFAULT_HUE || resolvePaletteKey(customColorKey) === DEFAULT_HUE
}
