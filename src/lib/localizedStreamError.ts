import {
  EN_TRANSLATIONS,
  translate,
  type AppLocale,
  type TranslationKey,
  type TranslationValues,
} from './i18n'

const LOCALIZED_ERROR_PREFIX = 'tolaria:i18n-error:'
const LEGACY_CLAUDE_AUTH_ERROR = 'Claude CLI is not authenticated. Run `claude auth login` in your terminal.'

interface LocalizedStreamErrorRequest {
  message: string
  locale: AppLocale
}

interface LocalizedErrorPayload {
  key: TranslationKey
  values?: TranslationValues
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function translationValuesFrom(value: unknown): TranslationValues | undefined {
  if (!isRecord(value)) return undefined

  const values: TranslationValues = {}
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'string' || typeof item === 'number') {
      values[key] = item
    }
  }
  return values
}

function isTranslationKey(value: unknown): value is TranslationKey {
  return typeof value === 'string' && Object.hasOwn(EN_TRANSLATIONS, value)
}

function parseLocalizedErrorPayload(message: string): LocalizedErrorPayload | null {
  if (!message.startsWith(LOCALIZED_ERROR_PREFIX)) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(message.slice(LOCALIZED_ERROR_PREFIX.length))
  } catch {
    return null
  }

  if (!isRecord(parsed) || !isTranslationKey(parsed.key)) return null

  return {
    key: parsed.key,
    values: translationValuesFrom(parsed.values),
  }
}

export function localizedStreamErrorMessage({
  message,
  locale,
}: LocalizedStreamErrorRequest): string {
  const payload = parseLocalizedErrorPayload(message)
  if (payload) return translate(locale, payload.key, payload.values)
  if (message === LEGACY_CLAUDE_AUTH_ERROR) {
    return translate(locale, 'ai.error.claude.notAuthenticated')
  }
  return message
}
