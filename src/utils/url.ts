import { isTauri } from '../mock-tauri'

const URL_PATTERN = /^https?:\/\//i
const BARE_DOMAIN_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z]{2,})+([/?#]|$)/i
const UNSAFE_URL_WHITESPACE_PATTERN = /\s/

export function normalizeExternalUrl(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed || UNSAFE_URL_WHITESPACE_PATTERN.test(trimmed)) return null

  const candidate = URL_PATTERN.test(trimmed)
    ? trimmed
    : BARE_DOMAIN_PATTERN.test(trimmed)
      ? `https://${trimmed}`
      : null

  if (!candidate) return null

  try {
    const parsed = new URL(candidate)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return candidate
  } catch {
    return null
  }
}

export function isUrlValue(value: string): boolean {
  return normalizeExternalUrl(value) !== null
}

export function normalizeUrl(url: string): string {
  const normalized = normalizeExternalUrl(url)
  if (normalized) return normalized
  if (URL_PATTERN.test(url)) return url
  return `https://${url}`
}

/** Open a URL in the system browser. Uses Tauri opener plugin in native mode, window.open in browser. */
export async function openExternalUrl(url: string): Promise<void> {
  const normalized = normalizeExternalUrl(url)
  if (!normalized) return

  if (isTauri()) {
    const { openUrl } = await import('@tauri-apps/plugin-opener')
    await openUrl(normalized)
  } else {
    window.open(normalized, '_blank')
  }
}

/** Open a local file path with the system default app (e.g. TextEdit for .json). */
export async function openLocalFile(absolutePath: string): Promise<void> {
  if (isTauri()) {
    const { openPath } = await import('@tauri-apps/plugin-opener')
    await openPath(absolutePath)
  }
}
