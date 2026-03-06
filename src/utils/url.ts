import { isTauri } from '../mock-tauri'

const URL_PATTERN = /^https?:\/\//i
const BARE_DOMAIN_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z]{2,})+([/?#]|$)/i

export function isUrlValue(value: string): boolean {
  if (!value) return false
  return URL_PATTERN.test(value) || BARE_DOMAIN_PATTERN.test(value)
}

export function normalizeUrl(url: string): string {
  if (URL_PATTERN.test(url)) return url
  return `https://${url}`
}

/** Open a URL in the system browser. Uses Tauri opener plugin in native mode, window.open in browser. */
export async function openExternalUrl(url: string): Promise<void> {
  if (isTauri()) {
    const { openUrl } = await import('@tauri-apps/plugin-opener')
    await openUrl(url)
  } else {
    window.open(url, '_blank')
  }
}

/** Open a local file path with the system default app (e.g. TextEdit for .json). */
export async function openLocalFile(absolutePath: string): Promise<void> {
  if (isTauri()) {
    const { openPath } = await import('@tauri-apps/plugin-opener')
    await openPath(absolutePath)
  }
}
