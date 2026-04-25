import { useEffect, type RefObject } from 'react'
import { isUrlValue, normalizeUrl, openExternalUrl } from '../utils/url'

const CODE_CONTEXT_SELECTOR = '[data-content-type="codeBlock"], pre, code'

function hasFollowModifier(event: KeyboardEvent | MouseEvent) {
  return event.metaKey || event.ctrlKey
}

function isInsideCodeContext(target: HTMLElement) {
  return !!target.closest(CODE_CONTEXT_SELECTOR)
}

function resolveWikilinkTarget(target: HTMLElement) {
  return target.closest<HTMLElement>('.wikilink[data-target]')?.dataset.target ?? null
}

function resolveUrlTarget(target: HTMLElement) {
  const href = target.closest<HTMLAnchorElement>('a[href]')?.getAttribute('href')?.trim()
  if (!href || !isUrlValue(href)) return null
  return normalizeUrl(href)
}

function blurActiveEditable(container: HTMLElement) {
  const active = document.activeElement
  if (!(active instanceof HTMLElement) || !container.contains(active)) return
  const editable = active.isContentEditable ? active : active.closest<HTMLElement>('[contenteditable="true"]')
  editable?.blur()
}

function setFollowLinksActive(container: HTMLElement, active: boolean) {
  if (active) container.setAttribute('data-follow-links', '')
  else container.removeAttribute('data-follow-links')
}

export function useEditorLinkActivation(
  containerRef: RefObject<HTMLDivElement | null>,
  onNavigateWikilink: (target: string) => void,
) {
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const resetModifierState = () => setFollowLinksActive(container, false)
    const handleModifierChange = (event: KeyboardEvent) => {
      setFollowLinksActive(container, hasFollowModifier(event))
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') resetModifierState()
    }
    const handleClick = (event: MouseEvent) => {
      if (!hasFollowModifier(event)) return
      if (!(event.target instanceof HTMLElement) || isInsideCodeContext(event.target)) return

      const wikilinkTarget = resolveWikilinkTarget(event.target)
      if (wikilinkTarget) {
        event.preventDefault()
        event.stopPropagation()
        blurActiveEditable(container)
        onNavigateWikilink(wikilinkTarget)
        return
      }

      const urlTarget = resolveUrlTarget(event.target)
      if (!urlTarget) return

      event.preventDefault()
      event.stopPropagation()
      openExternalUrl(urlTarget).catch((err) => console.warn('[link] Failed to open URL:', err))
    }

    container.addEventListener('click', handleClick, true)
    window.addEventListener('keydown', handleModifierChange)
    window.addEventListener('keyup', handleModifierChange)
    window.addEventListener('blur', resetModifierState)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      container.removeEventListener('click', handleClick, true)
      window.removeEventListener('keydown', handleModifierChange)
      window.removeEventListener('keyup', handleModifierChange)
      window.removeEventListener('blur', resetModifierState)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      resetModifierState()
    }
  }, [containerRef, onNavigateWikilink])
}
