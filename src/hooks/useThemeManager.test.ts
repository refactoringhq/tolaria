import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { ThemeFile, VaultSettings } from '../types'

const mockThemes: ThemeFile[] = [
  {
    id: 'default', name: 'Default', description: 'Clean default theme',
    colors: { background: '#FFFFFF', foreground: '#1A1A2E', primary: '#6366F1', border: '#E2E8F0', 'sidebar-background': '#F8FAFC' },
    typography: { 'font-family': 'Inter, sans-serif' },
    spacing: { 'sidebar-width': '240px' },
  },
  {
    id: 'dark', name: 'Dark', description: 'Dark theme',
    colors: { background: '#0F0F23', foreground: '#E2E8F0', primary: '#818CF8', border: '#1E293B' },
    typography: { 'font-family': 'Inter, sans-serif' },
    spacing: {},
  },
]

const mockSettings: VaultSettings = { theme: 'default' }

const mockInvokeFn = vi.fn(async (cmd: string) => {
  if (cmd === 'list_themes') return mockThemes
  if (cmd === 'get_vault_settings') return mockSettings
  if (cmd === 'set_active_theme') return null
  if (cmd === 'create_theme') return 'new-theme-id'
  return null
})

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: (cmd: string, args?: Record<string, unknown>) => mockInvokeFn(cmd, args),
}))

// Must import after mocks
const { useThemeManager, isColorDark } = await import('./useThemeManager')

describe('isColorDark', () => {
  it('identifies dark colors', () => {
    expect(isColorDark('#000000')).toBe(true)
    expect(isColorDark('#0F0F23')).toBe(true)
    expect(isColorDark('#1a1a2e')).toBe(true)
    expect(isColorDark('#0f0f1a')).toBe(true)
  })

  it('identifies light colors', () => {
    expect(isColorDark('#FFFFFF')).toBe(false)
    expect(isColorDark('#F7F6F3')).toBe(false)
    expect(isColorDark('#E0E0E0')).toBe(false)
  })
})

describe('useThemeManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInvokeFn.mockImplementation(async (cmd: string) => {
      if (cmd === 'list_themes') return mockThemes
      if (cmd === 'get_vault_settings') return mockSettings
      if (cmd === 'set_active_theme') return null
      if (cmd === 'create_theme') return 'new-theme-id'
      return null
    })
    // Clear any theme CSS properties from previous tests
    const root = document.documentElement
    root.style.cssText = ''
  })

  it('loads themes and active theme on mount', async () => {
    const { result } = renderHook(() => useThemeManager('/vault'))
    await waitFor(() => {
      expect(result.current.themes).toHaveLength(2)
    })
    expect(result.current.activeThemeId).toBe('default')
    expect(result.current.activeTheme?.name).toBe('Default')
  })

  it('returns empty state when vaultPath is null', async () => {
    const { result } = renderHook(() => useThemeManager(null))
    // Give it time to settle — should remain empty
    await new Promise(r => setTimeout(r, 50))
    expect(result.current.themes).toHaveLength(0)
    expect(result.current.activeThemeId).toBeNull()
    expect(result.current.activeTheme).toBeNull()
    expect(mockInvokeFn).not.toHaveBeenCalled()
  })

  it('applies CSS custom properties for active theme', async () => {
    const { result } = renderHook(() => useThemeManager('/vault'))
    await waitFor(() => {
      expect(result.current.activeTheme).not.toBeNull()
    })
    const root = document.documentElement
    expect(root.style.getPropertyValue('--background')).toBe('#FFFFFF')
    expect(root.style.getPropertyValue('--foreground')).toBe('#1A1A2E')
    expect(root.style.getPropertyValue('--primary')).toBe('#6366F1')
    expect(root.style.getPropertyValue('--theme-background')).toBe('#FFFFFF')
    expect(root.style.getPropertyValue('--theme-font-family')).toBe('Inter, sans-serif')
    expect(root.style.getPropertyValue('--theme-sidebar-width')).toBe('240px')
  })

  it('maps sidebar-background to --sidebar', async () => {
    const { result } = renderHook(() => useThemeManager('/vault'))
    await waitFor(() => {
      expect(result.current.activeTheme).not.toBeNull()
    })
    expect(document.documentElement.style.getPropertyValue('--sidebar')).toBe('#F8FAFC')
  })

  it('switchTheme calls set_active_theme and updates activeThemeId', async () => {
    const { result } = renderHook(() => useThemeManager('/vault'))
    await waitFor(() => {
      expect(result.current.themes).toHaveLength(2)
    })

    await act(async () => {
      await result.current.switchTheme('dark')
    })

    expect(mockInvokeFn).toHaveBeenCalledWith('set_active_theme', { vaultPath: '/vault', themeId: 'dark' })
    expect(result.current.activeThemeId).toBe('dark')
  })

  it('clears old theme CSS and applies new theme on switch', async () => {
    const { result } = renderHook(() => useThemeManager('/vault'))
    await waitFor(() => {
      expect(result.current.activeTheme?.id).toBe('default')
    })

    const root = document.documentElement
    expect(root.style.getPropertyValue('--background')).toBe('#FFFFFF')

    await act(async () => {
      await result.current.switchTheme('dark')
    })

    await waitFor(() => {
      expect(root.style.getPropertyValue('--background')).toBe('#0F0F23')
    })
    expect(root.style.getPropertyValue('--foreground')).toBe('#E2E8F0')
  })

  it('createTheme calls create_theme and reloads themes', async () => {
    const { result } = renderHook(() => useThemeManager('/vault'))
    await waitFor(() => {
      expect(result.current.themes).toHaveLength(2)
    })

    let newId = ''
    await act(async () => {
      newId = await result.current.createTheme('default')
    })

    expect(newId).toBe('new-theme-id')
    expect(mockInvokeFn).toHaveBeenCalledWith('create_theme', { vaultPath: '/vault', sourceId: 'default' })
    // Should reload after creation
    const listCalls = mockInvokeFn.mock.calls.filter(c => c[0] === 'list_themes')
    expect(listCalls.length).toBeGreaterThanOrEqual(2)
  })

  it('createTheme passes null source_id when no sourceId provided', async () => {
    const { result } = renderHook(() => useThemeManager('/vault'))
    await waitFor(() => {
      expect(result.current.themes).toHaveLength(2)
    })

    await act(async () => {
      await result.current.createTheme()
    })

    expect(mockInvokeFn).toHaveBeenCalledWith('create_theme', { vaultPath: '/vault', sourceId: null })
  })

  it('handles load failure gracefully', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockInvokeFn.mockRejectedValue(new Error('disk error'))

    const { result } = renderHook(() => useThemeManager('/vault'))
    await waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith('Failed to load themes:', expect.any(Error))
    })

    expect(result.current.themes).toHaveLength(0)
    expect(result.current.activeThemeId).toBeNull()
    warnSpy.mockRestore()
  })

  it('handles switchTheme failure gracefully', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { result } = renderHook(() => useThemeManager('/vault'))
    await waitFor(() => {
      expect(result.current.themes).toHaveLength(2)
    })

    mockInvokeFn.mockRejectedValueOnce(new Error('permission denied'))

    await act(async () => {
      await result.current.switchTheme('dark')
    })

    // Should not have changed the active theme
    expect(result.current.activeThemeId).toBe('default')
    expect(errorSpy).toHaveBeenCalledWith('Failed to switch theme:', expect.any(Error))
    errorSpy.mockRestore()
  })

  it('handles createTheme failure gracefully', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { result } = renderHook(() => useThemeManager('/vault'))
    await waitFor(() => {
      expect(result.current.themes).toHaveLength(2)
    })

    mockInvokeFn.mockRejectedValueOnce(new Error('write error'))

    let newId = ''
    await act(async () => {
      newId = await result.current.createTheme('default')
    })

    expect(newId).toBe('')
    expect(errorSpy).toHaveBeenCalledWith('Failed to create theme:', expect.any(Error))
    errorSpy.mockRestore()
  })

  it('switchTheme is a no-op when vaultPath is null', async () => {
    const { result } = renderHook(() => useThemeManager(null))
    await act(async () => {
      await result.current.switchTheme('dark')
    })
    expect(mockInvokeFn).not.toHaveBeenCalledWith('set_active_theme', expect.anything())
  })

  it('createTheme returns empty string when vaultPath is null', async () => {
    const { result } = renderHook(() => useThemeManager(null))
    let newId = ''
    await act(async () => {
      newId = await result.current.createTheme()
    })
    expect(newId).toBe('')
  })

  it('isDark is false for light theme', async () => {
    const { result } = renderHook(() => useThemeManager('/vault'))
    await waitFor(() => {
      expect(result.current.activeTheme?.id).toBe('default')
    })
    expect(result.current.isDark).toBe(false)
  })

  it('isDark is true for dark theme', async () => {
    const { result } = renderHook(() => useThemeManager('/vault'))
    await waitFor(() => {
      expect(result.current.themes).toHaveLength(2)
    })

    await act(async () => {
      await result.current.switchTheme('dark')
    })

    expect(result.current.isDark).toBe(true)
  })

  it('isDark is false when no active theme', async () => {
    const { result } = renderHook(() => useThemeManager(null))
    expect(result.current.isDark).toBe(false)
  })

  it('derives app-specific CSS variables from theme colors', async () => {
    const { result } = renderHook(() => useThemeManager('/vault'))
    await waitFor(() => {
      expect(result.current.activeTheme).not.toBeNull()
    })

    const root = document.documentElement
    expect(root.style.getPropertyValue('--bg-primary')).toBe('#FFFFFF')
    expect(root.style.getPropertyValue('--text-primary')).toBe('#1A1A2E')
    expect(root.style.getPropertyValue('--text-heading')).toBe('#1A1A2E')
    expect(root.style.getPropertyValue('--border-primary')).toBe('#E2E8F0')
  })

  it('sets color-scheme and data-theme-mode for dark theme', async () => {
    const { result } = renderHook(() => useThemeManager('/vault'))
    await waitFor(() => {
      expect(result.current.themes).toHaveLength(2)
    })

    await act(async () => {
      await result.current.switchTheme('dark')
    })

    const root = document.documentElement
    await waitFor(() => {
      expect(root.style.getPropertyValue('color-scheme')).toBe('dark')
    })
    expect(root.dataset.themeMode).toBe('dark')
    expect(root.style.getPropertyValue('--bg-primary')).toBe('#0F0F23')
    expect(root.style.getPropertyValue('--text-primary')).toBe('#E2E8F0')
  })

  it('sets color-scheme to light for light theme', async () => {
    const { result } = renderHook(() => useThemeManager('/vault'))
    await waitFor(() => {
      expect(result.current.activeTheme).not.toBeNull()
    })

    const root = document.documentElement
    expect(root.style.getPropertyValue('color-scheme')).toBe('light')
    expect(root.dataset.themeMode).toBe('light')
  })

  it('updates derived variables when switching between themes', async () => {
    const { result } = renderHook(() => useThemeManager('/vault'))
    await waitFor(() => {
      expect(result.current.themes).toHaveLength(2)
    })

    await act(async () => {
      await result.current.switchTheme('dark')
    })

    const root = document.documentElement
    await waitFor(() => {
      expect(root.style.getPropertyValue('--bg-primary')).toBe('#0F0F23')
    })

    await act(async () => {
      await result.current.switchTheme('default')
    })

    await waitFor(() => {
      expect(root.style.getPropertyValue('--bg-primary')).toBe('#FFFFFF')
    })
    expect(root.style.getPropertyValue('color-scheme')).toBe('light')
    expect(root.dataset.themeMode).toBe('light')
  })

  it('reloadThemes re-fetches theme list', async () => {
    const { result } = renderHook(() => useThemeManager('/vault'))
    await waitFor(() => {
      expect(result.current.themes).toHaveLength(2)
    })

    const initialListCalls = mockInvokeFn.mock.calls.filter(c => c[0] === 'list_themes').length

    await act(async () => {
      await result.current.reloadThemes()
    })

    const afterListCalls = mockInvokeFn.mock.calls.filter(c => c[0] === 'list_themes').length
    expect(afterListCalls).toBe(initialListCalls + 1)
  })
})
