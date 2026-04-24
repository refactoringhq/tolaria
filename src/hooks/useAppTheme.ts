import { useState, useEffect, useCallback } from 'react'
import { getAppStorageItem } from '../constants/appStorage'

export type AppTheme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'tolaria-theme'

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function loadPersistedTheme(): AppTheme {
  const stored = getAppStorageItem('theme')
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  return 'system'
}

function resolveTheme(theme: AppTheme): 'light' | 'dark' {
  return theme === 'system' ? getSystemTheme() : theme
}

function applyThemeToDocument(theme: AppTheme): void {
  const resolved = resolveTheme(theme)
  document.documentElement.classList.toggle('dark', resolved === 'dark')
}

function persistTheme(theme: AppTheme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // ignore
  }
}

export function useAppTheme() {
  const [theme, setThemeState] = useState<AppTheme>(() => {
    const t = loadPersistedTheme()
    applyThemeToDocument(t)
    return t
  })

  // Listen for OS-level theme changes when in 'system' mode
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      setThemeState(current => {
        if (current === 'system') applyThemeToDocument('system')
        return current
      })
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const setTheme = useCallback((next: AppTheme) => {
    applyThemeToDocument(next)
    persistTheme(next)
    setThemeState(next)
  }, [])

  const resolvedTheme = resolveTheme(theme)

  return { theme, resolvedTheme, setTheme }
}
