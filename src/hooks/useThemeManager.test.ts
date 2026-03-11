import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { VaultEntry } from '../types'

const THEME_PATH_DEFAULT = '/vault/theme/default.md'
const THEME_PATH_DARK = '/vault/theme/dark.md'

const DEFAULT_THEME_CONTENT = `---
type: Theme
Description: Light theme
background: "#FFFFFF"
foreground: "#37352F"
primary: "#155DFF"
sidebar: "#F7F6F3"
text-primary: "#37352F"
---

# Default Theme
`

const DARK_THEME_CONTENT = `---
type: Theme
Description: Dark theme
background: "#0f0f1a"
foreground: "#e0e0e0"
primary: "#155DFF"
sidebar: "#1a1a2e"
text-primary: "#e0e0e0"
---

# Dark Theme
`

function makeThemeEntry(path: string, title: string): VaultEntry {
  return {
    path,
    filename: path.split('/').pop()!,
    title,
    isA: 'Theme',
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: null,
    owner: null,
    cadence: null,
    archived: false,
    trashed: false,
    trashedAt: null,
    modifiedAt: null,
    createdAt: null,
    fileSize: 0,
    snippet: '',
    wordCount: 0,
    relationships: {},
    icon: null,
    color: null,
    order: null,
    sidebarLabel: null,
    template: null, sort: null,
    outgoingLinks: [],
    properties: {},
  }
}

const defaultEntry = makeThemeEntry(THEME_PATH_DEFAULT, 'Default Theme')
const darkEntry = makeThemeEntry(THEME_PATH_DARK, 'Dark Theme')

const mockInvokeFn = vi.fn(async (cmd: string, args?: Record<string, unknown>) => {
  if (cmd === 'get_vault_settings') return { theme: THEME_PATH_DEFAULT }
  if (cmd === 'get_note_content') {
    const path = args?.path as string | undefined
    if (path === THEME_PATH_DEFAULT) return DEFAULT_THEME_CONTENT
    if (path === THEME_PATH_DARK) return DARK_THEME_CONTENT
    return ''
  }
  if (cmd === 'set_active_theme') return null
  if (cmd === 'create_vault_theme') return '/vault/theme/untitled.md'
  return null
})

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: (cmd: string, args?: Record<string, unknown>) => mockInvokeFn(cmd, args),
}))

const { useThemeManager, extractCssVars, isColorDark } = await import('./useThemeManager')

describe('extractCssVars', () => {
  it('extracts color variables from frontmatter', () => {
    const vars = extractCssVars(DEFAULT_THEME_CONTENT)
    expect(vars['--background']).toBe('#FFFFFF')
    expect(vars['--foreground']).toBe('#37352F')
    expect(vars['--primary']).toBe('#155DFF')
  })

  it('excludes metadata keys', () => {
    const vars = extractCssVars(DEFAULT_THEME_CONTENT)
    expect('--Is A' in vars).toBe(false)
    expect('--Description' in vars).toBe(false)
  })
})

describe('isColorDark', () => {
  it('identifies dark colors', () => {
    expect(isColorDark('#000000')).toBe(true)
    expect(isColorDark('#0f0f1a')).toBe(true)
    expect(isColorDark('#1a1a2e')).toBe(true)
  })

  it('identifies light colors', () => {
    expect(isColorDark('#FFFFFF')).toBe(false)
    expect(isColorDark('#F7F6F3')).toBe(false)
    expect(isColorDark('#E0E0E0')).toBe(false)
  })

  it('returns false for invalid hex', () => {
    expect(isColorDark('')).toBe(false)
    expect(isColorDark('#abc')).toBe(false)
    expect(isColorDark('red')).toBe(false)
  })
})

describe('useThemeManager', () => {
  const entries = [defaultEntry, darkEntry]
  const allContent: Record<string, string> = {}

  beforeEach(() => {
    vi.clearAllMocks()
    mockInvokeFn.mockImplementation(async (cmd: string, args?: Record<string, unknown>) => {
      if (cmd === 'get_vault_settings') return { theme: THEME_PATH_DEFAULT }
      if (cmd === 'get_note_content') {
        const path = args?.path as string | undefined
        if (path === THEME_PATH_DEFAULT) return DEFAULT_THEME_CONTENT
        if (path === THEME_PATH_DARK) return DARK_THEME_CONTENT
        return ''
      }
      if (cmd === 'set_active_theme') return null
      if (cmd === 'create_vault_theme') return '/vault/theme/untitled.md'
      return null
    })
    document.documentElement.style.cssText = ''
  })

  it('builds themes list from vault entries with isA === Theme', async () => {
    const { result } = renderHook(() =>
      useThemeManager('/vault', entries, allContent)
    )
    await waitFor(() => {
      expect(result.current.themes).toHaveLength(2)
    })
    expect(result.current.themes[0].name).toBe('Default Theme')
    expect(result.current.themes[0].id).toBe(THEME_PATH_DEFAULT)
  })

  it('loads active theme from vault settings on mount', async () => {
    const { result } = renderHook(() =>
      useThemeManager('/vault', entries, allContent)
    )
    await waitFor(() => {
      expect(result.current.activeThemeId).toBe(THEME_PATH_DEFAULT)
    })
    expect(result.current.activeTheme?.name).toBe('Default Theme')
  })

  it('applies CSS vars from theme note content', async () => {
    const { result } = renderHook(() =>
      useThemeManager('/vault', entries, allContent)
    )
    await waitFor(() => {
      expect(result.current.activeTheme).not.toBeNull()
    })
    const root = document.documentElement
    expect(root.style.getPropertyValue('--background')).toBe('#FFFFFF')
    expect(root.style.getPropertyValue('--foreground')).toBe('#37352F')
    expect(root.style.getPropertyValue('--primary')).toBe('#155DFF')
  })

  it('returns empty state when vaultPath is null', async () => {
    const { result } = renderHook(() =>
      useThemeManager(null, entries, allContent)
    )
    await new Promise(r => setTimeout(r, 50))
    expect(result.current.activeThemeId).toBeNull()
    expect(result.current.activeTheme).toBeNull()
    expect(mockInvokeFn).not.toHaveBeenCalled()
  })

  it('excludes trashed entries from themes list', async () => {
    const trashedEntry = { ...darkEntry, trashed: true }
    const { result } = renderHook(() =>
      useThemeManager('/vault', [defaultEntry, trashedEntry], allContent)
    )
    await waitFor(() => {
      expect(result.current.themes).toHaveLength(1)
    })
    expect(result.current.themes[0].name).toBe('Default Theme')
  })

  it('switchTheme calls set_active_theme and updates activeThemeId', async () => {
    const { result } = renderHook(() =>
      useThemeManager('/vault', entries, allContent)
    )
    await waitFor(() => { expect(result.current.themes).toHaveLength(2) })

    await act(async () => {
      await result.current.switchTheme(THEME_PATH_DARK)
    })

    expect(mockInvokeFn).toHaveBeenCalledWith('set_active_theme', {
      vaultPath: '/vault', themeId: THEME_PATH_DARK,
    })
    expect(result.current.activeThemeId).toBe(THEME_PATH_DARK)
  })

  it('clears old CSS vars and applies new theme on switch', async () => {
    const { result } = renderHook(() =>
      useThemeManager('/vault', entries, allContent)
    )
    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue('--background')).toBe('#FFFFFF')
    })

    await act(async () => {
      await result.current.switchTheme(THEME_PATH_DARK)
    })

    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue('--background')).toBe('#0f0f1a')
    })
  })

  it('createTheme calls create_vault_theme and switches to new theme', async () => {
    const { result } = renderHook(() =>
      useThemeManager('/vault', entries, allContent)
    )
    await waitFor(() => { expect(result.current.themes).toHaveLength(2) })

    let newPath = ''
    await act(async () => {
      newPath = await result.current.createTheme('My Theme')
    })

    expect(newPath).toBe('/vault/theme/untitled.md')
    expect(mockInvokeFn).toHaveBeenCalledWith('create_vault_theme', {
      vaultPath: '/vault', name: 'My Theme',
    })
    expect(result.current.activeThemeId).toBe('/vault/theme/untitled.md')
  })

  it('createTheme passes null name when none provided', async () => {
    const { result } = renderHook(() =>
      useThemeManager('/vault', entries, allContent)
    )
    await waitFor(() => { expect(result.current.themes).toHaveLength(2) })

    await act(async () => {
      await result.current.createTheme()
    })

    expect(mockInvokeFn).toHaveBeenCalledWith('create_vault_theme', {
      vaultPath: '/vault', name: null,
    })
  })

  it('falls back when active theme is trashed', async () => {
    const { result, rerender } = renderHook(
      ({ ents }) => useThemeManager('/vault', ents, allContent),
      { initialProps: { ents: entries } },
    )
    await waitFor(() => {
      expect(result.current.activeThemeId).toBe(THEME_PATH_DEFAULT)
    })

    const trashedDefault = { ...defaultEntry, trashed: true }
    rerender({ ents: [trashedDefault, darkEntry] })

    await waitFor(() => {
      expect(result.current.activeThemeId).toBeNull()
    })
    // CSS vars are cleared from tracked applied vars — DOM state depends on prior apply
  })

  it('handles load failure gracefully', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockInvokeFn.mockRejectedValue(new Error('disk error'))

    const { result } = renderHook(() =>
      useThemeManager('/vault', entries, allContent)
    )
    await new Promise(r => setTimeout(r, 50))

    expect(result.current.activeThemeId).toBeNull()
    warnSpy.mockRestore()
  })

  it('handles switchTheme failure gracefully', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { result } = renderHook(() =>
      useThemeManager('/vault', entries, allContent)
    )
    await waitFor(() => { expect(result.current.themes).toHaveLength(2) })

    mockInvokeFn.mockRejectedValueOnce(new Error('permission denied'))

    await act(async () => {
      await result.current.switchTheme(THEME_PATH_DARK)
    })

    expect(result.current.activeThemeId).toBe(THEME_PATH_DEFAULT)
    errorSpy.mockRestore()
  })

  it('switchTheme is a no-op when vaultPath is null', async () => {
    const { result } = renderHook(() =>
      useThemeManager(null, entries, allContent)
    )
    await act(async () => {
      await result.current.switchTheme(THEME_PATH_DARK)
    })
    expect(mockInvokeFn).not.toHaveBeenCalledWith('set_active_theme', expect.anything())
  })

  it('createTheme returns empty string when vaultPath is null', async () => {
    const { result } = renderHook(() =>
      useThemeManager(null, entries, allContent)
    )
    let newPath = ''
    await act(async () => {
      newPath = await result.current.createTheme()
    })
    expect(newPath).toBe('')
  })

  it('reloadThemes re-reads vault settings', async () => {
    const { result } = renderHook(() =>
      useThemeManager('/vault', entries, allContent)
    )
    await waitFor(() => { expect(result.current.themes).toHaveLength(2) })

    const initialCalls = mockInvokeFn.mock.calls.filter(c => c[0] === 'get_vault_settings').length

    await act(async () => {
      await result.current.reloadThemes()
    })

    const afterCalls = mockInvokeFn.mock.calls.filter(c => c[0] === 'get_vault_settings').length
    expect(afterCalls).toBe(initialCalls + 1)
  })

  it('clears stale theme ID that does not match any known theme', async () => {
    mockInvokeFn.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_vault_settings') return { theme: 'untitled-2' }
      if (cmd === 'set_active_theme') return null
      if (cmd === 'ensure_vault_themes') return null
      return null
    })

    const { result } = renderHook(() =>
      useThemeManager('/vault', entries, allContent)
    )
    await waitFor(() => {
      expect(result.current.themes).toHaveLength(2)
    })

    // Stale ID "untitled-2" doesn't match any theme path — should be cleared
    await waitFor(() => {
      expect(result.current.activeThemeId).toBeNull()
    })
    expect(mockInvokeFn).toHaveBeenCalledWith('set_active_theme', {
      vaultPath: '/vault', themeId: null,
    })
  })

  it('sets color-scheme to light for light theme', async () => {
    const { result } = renderHook(() =>
      useThemeManager('/vault', entries, allContent)
    )
    await waitFor(() => {
      expect(result.current.activeTheme).not.toBeNull()
    })

    const root = document.documentElement
    expect(root.style.getPropertyValue('color-scheme')).toBe('light')
    expect(root.dataset.themeMode).toBe('light')
  })

  it('sets color-scheme to dark for dark theme', async () => {
    const { result } = renderHook(() =>
      useThemeManager('/vault', entries, allContent)
    )
    await waitFor(() => {
      expect(result.current.themes).toHaveLength(2)
    })

    await act(async () => {
      await result.current.switchTheme(THEME_PATH_DARK)
    })

    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue('color-scheme')).toBe('dark')
    })
    expect(document.documentElement.dataset.themeMode).toBe('dark')
  })

  it('isDark detects dark theme from cached content', async () => {
    const contentWithColors = {
      [THEME_PATH_DEFAULT]: DEFAULT_THEME_CONTENT,
      [THEME_PATH_DARK]: DARK_THEME_CONTENT,
    }
    mockInvokeFn.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_vault_settings') return { theme: THEME_PATH_DARK }
      if (cmd === 'set_active_theme') return null
      if (cmd === 'get_note_content') return DARK_THEME_CONTENT
      return null
    })

    const { result } = renderHook(() =>
      useThemeManager('/vault', entries, contentWithColors)
    )
    await waitFor(() => {
      expect(result.current.activeThemeId).toBe(THEME_PATH_DARK)
    })
    await waitFor(() => {
      expect(result.current.isDark).toBe(true)
    })
  })

  it('isDark is false for light theme', async () => {
    const contentWithColors = {
      [THEME_PATH_DEFAULT]: DEFAULT_THEME_CONTENT,
    }

    const { result } = renderHook(() =>
      useThemeManager('/vault', entries, contentWithColors)
    )
    await waitFor(() => {
      expect(result.current.activeThemeId).toBe(THEME_PATH_DEFAULT)
    })
    // Light theme isDark should be false (default state is false, so this is stable)
    expect(result.current.isDark).toBe(false)
  })

  it('notifyThemeSaved updates CSS vars when active theme is saved', async () => {
    const { result } = renderHook(() =>
      useThemeManager('/vault', entries, allContent)
    )
    await waitFor(() => {
      expect(result.current.activeThemeId).toBe(THEME_PATH_DEFAULT)
    })
    expect(document.documentElement.style.getPropertyValue('--background')).toBe('#FFFFFF')

    const updatedContent = `---
type: Theme
Description: Light theme
background: "#1a1a2e"
foreground: "#e0e0e0"
primary: "#155DFF"
sidebar: "#2a2a3e"
text-primary: "#e0e0e0"
---

# Default Theme
`
    act(() => {
      result.current.notifyThemeSaved(THEME_PATH_DEFAULT, updatedContent)
    })

    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue('--background')).toBe('#1a1a2e')
    })
    expect(document.documentElement.style.getPropertyValue('--sidebar')).toBe('#2a2a3e')
  })

  it('notifyThemeSaved is a no-op for non-active theme path', async () => {
    const { result } = renderHook(() =>
      useThemeManager('/vault', entries, allContent)
    )
    await waitFor(() => {
      expect(result.current.activeThemeId).toBe(THEME_PATH_DEFAULT)
    })
    expect(document.documentElement.style.getPropertyValue('--background')).toBe('#FFFFFF')

    act(() => {
      result.current.notifyThemeSaved(THEME_PATH_DARK, DARK_THEME_CONTENT)
    })

    // Background should still be the default theme's white, not dark
    await new Promise(r => setTimeout(r, 50))
    expect(document.documentElement.style.getPropertyValue('--background')).toBe('#FFFFFF')
  })

  it('calls ensure_vault_themes on mount with vaultPath', async () => {
    renderHook(() => useThemeManager('/vault', entries, allContent))
    await waitFor(() => {
      expect(mockInvokeFn).toHaveBeenCalledWith('ensure_vault_themes', { vaultPath: '/vault' })
    })
  })

  it('does not call ensure_vault_themes when vaultPath is null', async () => {
    renderHook(() => useThemeManager(null, entries, allContent))
    await new Promise(r => setTimeout(r, 50))
    expect(mockInvokeFn).not.toHaveBeenCalledWith('ensure_vault_themes', expect.anything())
  })
})
