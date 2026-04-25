import { useSyncExternalStore } from 'react'
import {
  DEFAULT_THEME_MODE,
  normalizeThemeMode,
  type ThemeMode,
} from '../lib/themeMode'

function readDocumentThemeMode(): ThemeMode {
  if (typeof document === 'undefined') return DEFAULT_THEME_MODE
  return normalizeThemeMode(document.documentElement.getAttribute('data-theme')) ?? DEFAULT_THEME_MODE
}

function subscribeDocumentThemeMode(onChange: () => void): () => void {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') {
    return () => {}
  }

  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, {
    attributeFilter: ['class', 'data-theme'],
    attributes: true,
  })

  return () => observer.disconnect()
}

export function useDocumentThemeMode(): ThemeMode {
  return useSyncExternalStore(
    subscribeDocumentThemeMode,
    readDocumentThemeMode,
    () => DEFAULT_THEME_MODE,
  )
}
