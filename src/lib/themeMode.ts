import { APP_STORAGE_KEYS, LEGACY_APP_STORAGE_KEYS } from '../constants/appStorage'

export const THEME_MODE_STORAGE_KEY = APP_STORAGE_KEYS.theme
export const LEGACY_THEME_MODE_STORAGE_KEY = LEGACY_APP_STORAGE_KEYS.theme
export const DEFAULT_THEME_MODE = 'light'

const THEME_MODES = new Set(['light', 'dark'])

export type ThemeMode = 'light' | 'dark'

type ThemeStorage = Pick<Storage, 'getItem' | 'setItem'>
type ThemeDocument = Pick<Document, 'documentElement'>

export function normalizeThemeMode(value: unknown): ThemeMode | null {
  return typeof value === 'string' && THEME_MODES.has(value) ? value as ThemeMode : null
}

export function resolveThemeMode(value: unknown): ThemeMode {
  return normalizeThemeMode(value) ?? DEFAULT_THEME_MODE
}

function safeGetThemeMode(storage: ThemeStorage, key: string): ThemeMode | null {
  try {
    return normalizeThemeMode(storage.getItem(key))
  } catch {
    return null
  }
}

function safeSetThemeMode(storage: ThemeStorage, key: string, mode: ThemeMode): void {
  try {
    storage.setItem(key, mode)
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}

export function readStoredThemeMode(storage: ThemeStorage): ThemeMode | null {
  const storedMode = safeGetThemeMode(storage, THEME_MODE_STORAGE_KEY)
  if (storedMode) return storedMode

  const legacyMode = safeGetThemeMode(storage, LEGACY_THEME_MODE_STORAGE_KEY)
  if (!legacyMode) return null

  safeSetThemeMode(storage, THEME_MODE_STORAGE_KEY, legacyMode)
  return legacyMode
}

export function writeStoredThemeMode(storage: ThemeStorage, mode: ThemeMode): void {
  safeSetThemeMode(storage, THEME_MODE_STORAGE_KEY, mode)
}

export function applyThemeModeToDocument(documentObject: ThemeDocument, mode: ThemeMode): void {
  const root = documentObject.documentElement
  root.setAttribute('data-theme', mode)
  root.classList.toggle('dark', mode === 'dark')
}

export function applyStoredThemeMode(
  documentObject: ThemeDocument,
  storage: ThemeStorage,
): ThemeMode {
  const mode = readStoredThemeMode(storage) ?? DEFAULT_THEME_MODE
  applyThemeModeToDocument(documentObject, mode)
  return mode
}
