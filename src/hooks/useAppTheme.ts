import { useState, useEffect, useCallback } from 'react'
import { APP_STORAGE_KEYS, LEGACY_APP_STORAGE_KEYS, getAppStorageItem } from '../constants/appStorage'

export type AppTheme = 'light' | 'dark' | 'system'

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
    localStorage.setItem(APP_STORAGE_KEYS.theme, theme)
    localStorage.removeItem(LEGACY_APP_STORAGE_KEYS.theme)
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Shared singleton MutationObserver for html.dark class changes
// ---------------------------------------------------------------------------

type DarkClassHandler = () => void
const darkClassSubscribers = new Set<DarkClassHandler>()
let darkClassObserver: MutationObserver | null = null

function subscribeToDarkClass(handler: DarkClassHandler): () => void {
  darkClassSubscribers.add(handler)
  if (!darkClassObserver) {
    darkClassObserver = new MutationObserver(() => {
      darkClassSubscribers.forEach(fn => fn())
    })
    darkClassObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  }
  return () => {
    darkClassSubscribers.delete(handler)
    if (darkClassSubscribers.size === 0 && darkClassObserver) {
      darkClassObserver.disconnect()
      darkClassObserver = null
    }
  }
}

/** Tracks whether `<html>` has the `dark` class, sharing a single MutationObserver. */
export function useResolvedTheme(): 'light' | 'dark' {
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains('dark')
  )
  useEffect(() => subscribeToDarkClass(() => {
    setIsDark(document.documentElement.classList.contains('dark'))
  }), [])
  return isDark ? 'dark' : 'light'
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
