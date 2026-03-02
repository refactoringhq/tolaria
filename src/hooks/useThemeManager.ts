import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'
import { parseFrontmatter } from '../utils/frontmatter'
import type { ThemeFile, VaultEntry, VaultSettings } from '../types'

function tauriCall<T>(command: string, args: Record<string, unknown>): Promise<T> {
  return isTauri() ? invoke<T>(command, args) : mockInvoke<T>(command, args)
}

/** Frontmatter keys that are metadata — not CSS custom properties. */
const NON_THEME_KEYS = new Set([
  'Is A', 'type', 'is_a', 'is a',
  'Name', 'name', 'title', 'Title',
  'Description', 'description',
  'Archived', 'archived',
  'Trashed', 'trashed',
  'Trashed at', 'trashed at', 'trashed_at',
  'Created at', 'created at', 'created_at',
  'Created time', 'created_time',
  'Owner', 'owner',
  'Status', 'status',
  'Cadence', 'cadence',
  'aliases',
  'Belongs to', 'belongs_to', 'belongs to',
  'Related to', 'related_to', 'related to',
])

/** Extract CSS custom properties from a theme note's frontmatter content. */
export function extractCssVars(content: string): Record<string, string> {
  const fm = parseFrontmatter(content)
  const vars: Record<string, string> = {}
  for (const [key, value] of Object.entries(fm)) {
    if (NON_THEME_KEYS.has(key)) continue
    if (typeof value === 'string' && value) {
      vars[`--${key}`] = value
    } else if (typeof value === 'number') {
      vars[`--${key}`] = String(value)
    }
  }
  return vars
}

function applyVarsToDom(vars: Record<string, string>): void {
  const root = document.documentElement
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value)
  }
}

function clearVarsFromDom(vars: Record<string, string>): void {
  const root = document.documentElement
  for (const key of Object.keys(vars)) {
    root.style.removeProperty(key)
  }
}

/** Build a ThemeFile descriptor from a vault entry (metadata only). */
function entryToThemeFile(entry: VaultEntry): ThemeFile {
  return {
    id: entry.path,
    name: entry.title,
    description: '',
    path: entry.path,
    colors: {},
    typography: {},
    spacing: {},
  }
}

/** True when a theme entry should no longer be applied (trashed or archived). */
function isEntryRemoved(entry: VaultEntry): boolean {
  return entry.trashed || entry.archived
}

export interface ThemeManager {
  themes: ThemeFile[]
  activeThemeId: string | null
  activeTheme: ThemeFile | null
  isDark: boolean
  switchTheme: (themeId: string) => Promise<void>
  createTheme: (name?: string) => Promise<string>
  reloadThemes: () => Promise<void>
}

/** Manages loading and persisting the active theme path from vault settings. */
function useThemeSetting(vaultPath: string | null) {
  const [activeThemeId, setActiveThemeId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!vaultPath) return
    try {
      const s = await tauriCall<VaultSettings>('get_vault_settings', { vaultPath })
      setActiveThemeId(s.theme)
    } catch { /* no settings file — fine, no active theme */ }
  }, [vaultPath])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- async fn; setState runs after await
  useEffect(() => { load() }, [load])

  useEffect(() => {
    window.addEventListener('focus', load)
    return () => window.removeEventListener('focus', load)
  }, [load])

  return { activeThemeId, setActiveThemeId, reload: load }
}

/** Applies CSS custom properties to the document root from the active theme. */
function useThemeApplier(
  activeThemeId: string | null,
  cachedContent: string | undefined,
) {
  const appliedVarsRef = useRef<Record<string, string>>({})

  const apply = useCallback((content: string) => {
    const newVars = extractCssVars(content)
    clearVarsFromDom(appliedVarsRef.current)
    applyVarsToDom(newVars)
    appliedVarsRef.current = newVars
  }, [])

  const clear = useCallback(() => {
    clearVarsFromDom(appliedVarsRef.current)
    appliedVarsRef.current = {}
  }, [])

  // Apply theme when activeThemeId or cached content changes.
  // Also serves as live-preview: re-applies when the user saves the theme note.
  useEffect(() => {
    if (!activeThemeId) { clear(); return }
    if (cachedContent) { apply(cachedContent); return }
    tauriCall<string>('get_note_content', { path: activeThemeId })
      .then(apply)
      .catch(clear)
  }, [activeThemeId, cachedContent, apply, clear])

  return { clear }
}

export function useThemeManager(
  vaultPath: string | null,
  entries: VaultEntry[],
  allContent: Record<string, string>,
): ThemeManager {
  const { activeThemeId, setActiveThemeId, reload } = useThemeSetting(vaultPath)
  const cachedThemeContent = activeThemeId ? allContent[activeThemeId] : undefined
  const { clear: clearTheme } = useThemeApplier(activeThemeId, cachedThemeContent)

  const themes = useMemo(
    () => entries.filter(e => e.isA === 'Theme' && !e.trashed && !e.archived).map(entryToThemeFile),
    [entries],
  )

  const activeTheme = useMemo(
    () => themes.find(t => t.id === activeThemeId) ?? null,
    [themes, activeThemeId],
  )

  // If active theme is trashed or archived: clear CSS vars and fall back to no theme
  useEffect(() => {
    if (!activeThemeId) return
    const entry = entries.find(e => e.path === activeThemeId)
    if (!entry || !isEntryRemoved(entry)) return
    clearTheme()
    setActiveThemeId(null)
    if (vaultPath) tauriCall('set_active_theme', { vaultPath, themeId: null }).catch(() => {})
  }, [entries, activeThemeId, clearTheme, vaultPath, setActiveThemeId])

  const switchTheme = useCallback(async (themeId: string) => {
    if (!vaultPath) return
    try {
      await tauriCall<null>('set_active_theme', { vaultPath, themeId })
      setActiveThemeId(themeId)
    } catch (err) { console.error('Failed to switch theme:', err) }
  }, [vaultPath, setActiveThemeId])

  const createTheme = useCallback(async (name?: string) => {
    if (!vaultPath) return ''
    try {
      const path = await tauriCall<string>('create_vault_theme', { vaultPath, name: name ?? null })
      await tauriCall<null>('set_active_theme', { vaultPath, themeId: path })
      setActiveThemeId(path)
      return path
    } catch (err) { console.error('Failed to create theme:', err); return '' }
  }, [vaultPath, setActiveThemeId])

  const reloadThemes = useCallback(async () => { await reload() }, [reload])

  // Determine if the active theme is dark by checking --background CSS variable
  const isDark = useMemo(() => {
    if (!activeThemeId || !cachedThemeContent) return false
    const vars = extractCssVars(cachedThemeContent)
    const bg = vars['--background'] ?? ''
    if (!bg.startsWith('#') || bg.length < 7) return false
    const r = parseInt(bg.slice(1, 3), 16)
    const g = parseInt(bg.slice(3, 5), 16)
    const b = parseInt(bg.slice(5, 7), 16)
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5
  }, [activeThemeId, cachedThemeContent])

  return { themes, activeThemeId, activeTheme, isDark, switchTheme, createTheme, reloadThemes }
}
