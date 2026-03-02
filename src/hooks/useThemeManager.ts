import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'
import type { ThemeFile, VaultSettings } from '../types'

function tauriCall<T>(command: string, args: Record<string, unknown>): Promise<T> {
  return isTauri() ? invoke<T>(command, args) : mockInvoke<T>(command, args)
}

// --- Color utilities for theme variable derivation ---

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function toHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(c => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0')).join('')
}

/** Blend two hex colors. ratio=0 → color1, ratio=1 → color2. */
function mixColors(hex1: string, hex2: string, ratio: number): string {
  const [r1, g1, b1] = parseHex(hex1)
  const [r2, g2, b2] = parseHex(hex2)
  return toHex(r1 + (r2 - r1) * ratio, g1 + (g2 - g1) * ratio, b1 + (b2 - b1) * ratio)
}

/** Check if a hex color is perceptually dark (luminance < 0.5). */
export function isColorDark(hex: string): boolean {
  const [r, g, b] = parseHex(hex)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5
}

// Variables derived from theme core colors (not present in theme.colors directly)
const DERIVED_VAR_NAMES = [
  'bg-primary', 'bg-sidebar', 'bg-card', 'bg-hover', 'bg-hover-subtle', 'bg-selected',
  'bg-input', 'bg-button', 'bg-dialog',
  'text-primary', 'text-heading', 'text-secondary', 'text-tertiary', 'text-muted', 'text-faint',
  'border-primary', 'border-subtle', 'border-input', 'border-dialog',
  'link-color', 'link-hover',
  // shadcn variables that may not be in the theme
  'card', 'card-foreground', 'popover', 'popover-foreground',
  'secondary', 'secondary-foreground', 'muted-foreground',
  'accent', 'accent-foreground', 'input', 'ring',
  'sidebar-foreground', 'sidebar-primary', 'sidebar-primary-foreground',
  'sidebar-accent', 'sidebar-accent-foreground', 'sidebar-border', 'sidebar-ring',
]

/** Derive app-specific and missing shadcn CSS variables from core theme colors. */
function deriveThemeVariables(root: HTMLElement, colors: Record<string, string>): void {
  const bg = colors.background
  const fg = colors.foreground
  if (!bg || !fg) return

  const isDark = isColorDark(bg)
  root.style.setProperty('color-scheme', isDark ? 'dark' : 'light')
  root.dataset.themeMode = isDark ? 'dark' : 'light'

  const primary = colors.primary ?? (isDark ? '#5C9CFF' : '#155DFF')
  const border = colors.border ?? mixColors(bg, fg, isDark ? 0.15 : 0.08)
  const muted = colors.muted ?? mixColors(bg, fg, isDark ? 0.08 : 0.05)
  const sidebarBg = colors['sidebar-background'] ?? mixColors(bg, fg, 0.04)

  // App-specific variables
  root.style.setProperty('--bg-primary', bg)
  root.style.setProperty('--bg-sidebar', sidebarBg)
  root.style.setProperty('--bg-card', mixColors(bg, fg, 0.03))
  root.style.setProperty('--bg-hover', mixColors(bg, fg, 0.1))
  root.style.setProperty('--bg-hover-subtle', muted)
  root.style.setProperty('--bg-selected', `${primary}25`)
  root.style.setProperty('--bg-input', bg)
  root.style.setProperty('--bg-button', mixColors(bg, fg, 0.1))
  root.style.setProperty('--bg-dialog', mixColors(bg, fg, 0.02))

  root.style.setProperty('--text-primary', fg)
  root.style.setProperty('--text-heading', fg)
  root.style.setProperty('--text-secondary', mixColors(fg, bg, 0.25))
  root.style.setProperty('--text-tertiary', mixColors(fg, bg, 0.35))
  root.style.setProperty('--text-muted', mixColors(fg, bg, 0.5))
  root.style.setProperty('--text-faint', mixColors(fg, bg, 0.6))

  root.style.setProperty('--border-primary', border)
  root.style.setProperty('--border-subtle', border)
  root.style.setProperty('--border-input', border)
  root.style.setProperty('--border-dialog', border)

  root.style.setProperty('--link-color', primary)
  root.style.setProperty('--link-hover', mixColors(primary, fg, 0.2))

  // Shadcn variables — only set if not already provided by the theme
  const setIfMissing = (name: string, value: string) => {
    if (!(name in colors)) root.style.setProperty(`--${name}`, value)
  }
  setIfMissing('card', mixColors(bg, fg, 0.03))
  setIfMissing('card-foreground', fg)
  setIfMissing('popover', mixColors(bg, fg, 0.04))
  setIfMissing('popover-foreground', fg)
  setIfMissing('secondary', mixColors(bg, fg, 0.08))
  setIfMissing('secondary-foreground', fg)
  setIfMissing('muted-foreground', mixColors(fg, bg, 0.3))
  setIfMissing('accent', mixColors(bg, fg, 0.08))
  setIfMissing('accent-foreground', fg)
  setIfMissing('input', border)
  setIfMissing('ring', primary)
  setIfMissing('sidebar-foreground', fg)
  setIfMissing('sidebar-accent', mixColors(sidebarBg, fg, 0.1))
  setIfMissing('sidebar-accent-foreground', fg)
  setIfMissing('sidebar-border', border)
  setIfMissing('sidebar-primary', primary)
  setIfMissing('sidebar-primary-foreground', '#FFFFFF')
  setIfMissing('sidebar-ring', primary)
}

function clearDerivedVariables(root: HTMLElement): void {
  for (const name of DERIVED_VAR_NAMES) {
    root.style.removeProperty(`--${name}`)
  }
  root.style.removeProperty('color-scheme')
  delete root.dataset.themeMode
}

/** Map theme colors/typography/spacing to CSS custom properties on :root. */
function applyThemeToDom(theme: ThemeFile): void {
  const root = document.documentElement
  for (const [key, value] of Object.entries(theme.colors)) {
    root.style.setProperty(`--theme-${key}`, value)
    root.style.setProperty(`--${key}`, value)
  }
  for (const [key, value] of Object.entries(theme.typography)) {
    root.style.setProperty(`--theme-${key}`, value)
  }
  for (const [key, value] of Object.entries(theme.spacing)) {
    root.style.setProperty(`--theme-${key}`, value)
  }
  if (theme.colors['sidebar-background']) {
    root.style.setProperty('--sidebar', theme.colors['sidebar-background'])
  }
  deriveThemeVariables(root, theme.colors)
}

function clearThemeFromDom(theme: ThemeFile): void {
  const root = document.documentElement
  for (const key of Object.keys(theme.colors)) {
    root.style.removeProperty(`--theme-${key}`)
    root.style.removeProperty(`--${key}`)
  }
  for (const key of Object.keys(theme.typography)) {
    root.style.removeProperty(`--theme-${key}`)
  }
  for (const key of Object.keys(theme.spacing)) {
    root.style.removeProperty(`--theme-${key}`)
  }
  root.style.removeProperty('--sidebar')
  clearDerivedVariables(root)
}

export interface ThemeManager {
  themes: ThemeFile[]
  activeThemeId: string | null
  activeTheme: ThemeFile | null
  isDark: boolean
  switchTheme: (themeId: string) => Promise<void>
  createTheme: (sourceId?: string) => Promise<string>
  reloadThemes: () => Promise<void>
}

/** Sync CSS custom properties: clear old theme, apply new one. */
function syncThemeDom(
  prevRef: React.MutableRefObject<ThemeFile | null>,
  theme: ThemeFile | null,
): void {
  if (prevRef.current) clearThemeFromDom(prevRef.current)
  if (theme) {
    applyThemeToDom(theme)
    prevRef.current = theme
  } else {
    prevRef.current = null
  }
}

export function useThemeManager(vaultPath: string | null): ThemeManager {
  const [themes, setThemes] = useState<ThemeFile[]>([])
  const [activeThemeId, setActiveThemeId] = useState<string | null>(null)
  const prevThemeRef = useRef<ThemeFile | null>(null)

  const activeTheme = themes.find(t => t.id === activeThemeId) ?? null
  const isDark = activeTheme?.colors.background ? isColorDark(activeTheme.colors.background) : false

  const loadThemes = useCallback(async () => {
    if (!vaultPath) return
    try {
      const [themeList, settings] = await Promise.all([
        tauriCall<ThemeFile[]>('list_themes', { vaultPath }),
        tauriCall<VaultSettings>('get_vault_settings', { vaultPath }),
      ])
      setThemes(themeList)
      setActiveThemeId(settings.theme)
    } catch (err) {
      console.warn('Failed to load themes:', err)
    }
  }, [vaultPath])

  useEffect(() => { loadThemes() }, [loadThemes]) // eslint-disable-line react-hooks/set-state-in-effect -- trigger initial load
  useEffect(() => { syncThemeDom(prevThemeRef, activeTheme) }, [activeTheme])

  // Reload themes when window regains focus (live reload for external edits)
  useEffect(() => {
    const onFocus = () => { loadThemes() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [loadThemes])

  const switchTheme = useCallback(async (themeId: string) => {
    if (!vaultPath) return
    try {
      await tauriCall<null>('set_active_theme', { vaultPath, themeId })
      setActiveThemeId(themeId)
    } catch (err) {
      console.error('Failed to switch theme:', err)
    }
  }, [vaultPath])

  const createTheme = useCallback(async (sourceId?: string) => {
    if (!vaultPath) return ''
    try {
      const newId = await tauriCall<string>('create_theme', {
        vaultPath,
        sourceId: sourceId ?? null,
      })
      await loadThemes()
      await switchTheme(newId)
      return newId
    } catch (err) {
      console.error('Failed to create theme:', err)
      return ''
    }
  }, [vaultPath, loadThemes, switchTheme])

  return { themes, activeThemeId, activeTheme, isDark, switchTheme, createTheme, reloadThemes: loadThemes }
}
