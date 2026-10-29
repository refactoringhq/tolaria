import { mobileWikilinkHref } from '../../workspace/mobileWikilinks'

export const mobileWysiwygLinkActionType = 'mobile-open-link'

type MobileWysiwygLinkHandlers = {
  onNavigateWikilink?: (target: string) => void
  onOpenLink?: (href: string) => void
}

export type MobileWysiwygLinkKind = 'external' | 'wikilink'

export function routeMobileWysiwygLink(
  href: string,
  handlers: MobileWysiwygLinkHandlers,
): MobileWysiwygLinkKind | null {
  const wikilinkPrefix = mobileWikilinkHref('')
  if (href.startsWith(wikilinkPrefix)) {
    const target = decodeWikilinkTarget(href.slice(wikilinkPrefix.length))
    if (!target || !handlers.onNavigateWikilink) return null
    handlers.onNavigateWikilink(target)
    return 'wikilink'
  }

  if (!isSupportedExternalHref(href) || !handlers.onOpenLink) return null
  handlers.onOpenLink(href)
  return 'external'
}

function decodeWikilinkTarget(encodedTarget: string): string | null {
  try {
    const target = decodeURIComponent(encodedTarget).trim()
    return target.length > 0 ? target : null
  } catch {
    return null
  }
}

function isSupportedExternalHref(href: string): boolean {
  try {
    const protocol = new URL(href).protocol.toLowerCase()
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(protocol)
  } catch {
    return false
  }
}
