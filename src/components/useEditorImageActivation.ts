import { useEffect, type RefObject } from 'react'
import { openLocalFile } from '../utils/url'

const ASSET_URL_PREFIXES = ['asset://localhost/', 'http://asset.localhost/']
const IMAGE_ANCESTOR_SELECTOR = [
  '[data-content-type="image"]',
  '.bn-visual-media-wrapper',
  '.bn-file-block-content-wrapper',
].join(', ')

function resolveAssetPath(src: string): string | null {
  const prefix = ASSET_URL_PREFIXES.find(candidate => src.startsWith(candidate))
  if (!prefix) return null

  try {
    return decodeURIComponent(src.slice(prefix.length))
  } catch {
    return null
  }
}

function findImageNear(target: EventTarget | null): HTMLImageElement | null {
  if (!(target instanceof Element)) return null
  const direct = target.closest('img')
  if (direct) return direct as HTMLImageElement
  const imageBlock = target.closest(IMAGE_ANCESTOR_SELECTOR)
  return imageBlock?.querySelector('img') ?? null
}

function resolveImageTarget(target: EventTarget | null): string | null {
  const img = findImageNear(target)
  if (!img) return null
  const src = img.getAttribute('src')
  return src ? resolveAssetPath(src) : null
}

function hasFollowModifier(event: MouseEvent) {
  return event.metaKey || event.ctrlKey
}

export function useEditorImageActivation(
  containerRef: RefObject<HTMLDivElement | null>,
) {
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleClick = (event: MouseEvent) => {
      if (!hasFollowModifier(event)) return
      const absolutePath = resolveImageTarget(event.target)
      if (!absolutePath) return

      event.preventDefault()
      event.stopPropagation()
      openLocalFile(absolutePath).catch(() => {})
    }

    const handleMouseDown = (event: MouseEvent) => {
      if (!hasFollowModifier(event)) return
      if (!resolveImageTarget(event.target)) return
      event.preventDefault()
      event.stopPropagation()
    }

    container.addEventListener('click', handleClick, true)
    container.addEventListener('mousedown', handleMouseDown, true)
    return () => {
      container.removeEventListener('click', handleClick, true)
      container.removeEventListener('mousedown', handleMouseDown, true)
    }
  }, [containerRef])
}
