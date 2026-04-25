export const SUPPORTED_LANGUAGES = ['en', 'zh-CN', 'ja'] as const
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

const LANGUAGE_STORAGE_KEY = 'tolaria-language'

const VALID_LANGUAGES: Set<string> = new Set(SUPPORTED_LANGUAGES)
const LANGUAGE_ALIASES: Record<string, SupportedLanguage> = {
  en: 'en',
  'en-us': 'en',
  'en-gb': 'en',
  ja: 'ja',
  'ja-jp': 'ja',
  zh: 'zh-CN',
  'zh-cn': 'zh-CN',
  'zh-hans': 'zh-CN',
  'zh-hans-cn': 'zh-CN',
}

export function normalizeLanguage(value: unknown): SupportedLanguage | null {
  if (typeof value !== 'string') return null
  const languageTag = value.trim().toLowerCase().replaceAll('_', '-')
  return LANGUAGE_ALIASES[languageTag] ?? null
}

export function detectLanguage(
  rustSettingsLanguage: unknown,
  storage: Pick<Storage, 'getItem'>,
  navigatorLanguage?: string,
): SupportedLanguage {
  // 1. Rust settings (user explicit choice)
  const rustLang = normalizeLanguage(rustSettingsLanguage)
  if (rustLang) return rustLang

  // 2. localStorage quick cache
  try {
    const stored = storage.getItem(LANGUAGE_STORAGE_KEY)
    const storedLang = normalizeLanguage(stored)
    if (storedLang) return storedLang
  } catch {
    // Storage unavailable
  }

  // 3. System/browser language detection
  if (navigatorLanguage) {
    const navLang = normalizeLanguage(navigatorLanguage)
    if (navLang) return navLang
  }

  // 4. Default English
  return 'en'
}

export function writeLanguageToStorage(
  storage: Pick<Storage, 'setItem'>,
  language: SupportedLanguage,
): void {
  try {
    storage.setItem(LANGUAGE_STORAGE_KEY, language)
  } catch {
    // Storage unavailable
  }
}

export function isValidLanguage(value: unknown): value is SupportedLanguage {
  return typeof value === 'string' && VALID_LANGUAGES.has(value)
}
