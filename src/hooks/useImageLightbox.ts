import { useCallback, useEffect, useState, type RefObject } from 'react'
import { getDoubleClickedImageSrc } from '../utils/imageLightboxTarget'

interface UseImageLightboxArgs {
  containerRef: RefObject<HTMLDivElement | null>
}

interface UseImageLightboxResult {
  src: string | null
  close: () => void
}

export function useImageLightbox({ containerRef }: UseImageLightboxArgs): UseImageLightboxResult {
  const [src, setSrc] = useState<string | null>(null)
  const close = useCallback(() => setSrc(null), [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const onDoubleClick = (event: MouseEvent) => {
      const next = getDoubleClickedImageSrc(event.target)
      if (!next) return
      event.preventDefault()
      setSrc(next)
    }

    container.addEventListener('dblclick', onDoubleClick)
    return () => container.removeEventListener('dblclick', onDoubleClick)
  }, [containerRef])

  return { src, close }
}
