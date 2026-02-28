import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'
import type { ThemeFile, VaultSettings } from '../types'

function tauriCall<T>(command: string, args: Record<string, unknown>): Promise<T> {
  return isTauri() ? invoke<T>(command, args) : mockInvoke<T>(command, args)
}

/** Map theme colors/typography/spacing to CSS custom properties on :root. */
function applyThemeToDom(theme: ThemeFile): void {
  const root = document.documentElement
  for (const [key, value] of Object.entries(theme.colors)) {
    root.style.setProperty(`--theme-${key}`, value)
    // Also set the shadcn-compatible variables
    root.style.setProperty(`--${key}`, value)
  }
  for (const [key, value] of Object.entries(theme.typography)) {
    root.style.setProperty(`--theme-${key}`, value)
  }
  for (const [key, value] of Object.entries(theme.spacing)) {
    root.style.setProperty(`--theme-${key}`, value)
  }
  // Map sidebar-background to --sidebar (shadcn convention)
  if (theme.colors['sidebar-background']) {
    root.style.setProperty('--sidebar', theme.colors['sidebar-background'])
  }
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
}

export interface ThemeManager {
  themes: ThemeFile[]
  activeThemeId: string | null
  activeTheme: ThemeFile | null
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

  const loadThemes = useCallback(async () => {
    if (!vaultPath) return
    try {
      const [themeList, settings] = await Promise.all([
        tauriCall<ThemeFile[]>('list_themes', { vault_path: vaultPath }),
        tauriCall<VaultSettings>('get_vault_settings', { vault_path: vaultPath }),
      ])
      setThemes(themeList)
      setActiveThemeId(settings.theme)
    } catch (err) {
      console.warn('Failed to load themes:', err)
    }
  }, [vaultPath])

  useEffect(() => { loadThemes() }, [loadThemes]) // eslint-disable-line react-hooks/set-state-in-effect -- trigger initial load
  useEffect(() => { syncThemeDom(prevThemeRef, activeTheme) }, [activeTheme])

  const switchTheme = useCallback(async (themeId: string) => {
    if (!vaultPath) return
    try {
      await tauriCall<null>('set_active_theme', { vault_path: vaultPath, theme_id: themeId })
      setActiveThemeId(themeId)
    } catch (err) {
      console.error('Failed to switch theme:', err)
    }
  }, [vaultPath])

  const createTheme = useCallback(async (sourceId?: string) => {
    if (!vaultPath) return ''
    try {
      const newId = await tauriCall<string>('create_theme', {
        vault_path: vaultPath,
        source_id: sourceId ?? null,
      })
      await loadThemes()
      return newId
    } catch (err) {
      console.error('Failed to create theme:', err)
      return ''
    }
  }, [vaultPath, loadThemes])

  return { themes, activeThemeId, activeTheme, switchTheme, createTheme, reloadThemes: loadThemes }
}
