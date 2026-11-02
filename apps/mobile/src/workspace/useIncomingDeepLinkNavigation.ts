import { useEffect } from 'react'
import type { MobileDeepLinkNavigationRequest } from './useMobileIncomingDeepLink'

export function useIncomingDeepLinkNavigation(
  request: MobileDeepLinkNavigationRequest | null | undefined,
  navigate: (noteId: string) => void,
  onHandled?: (requestId: number) => void,
) {
  useEffect(() => {
    if (!request) return
    navigate(request.noteId)
    onHandled?.(request.requestId)
  }, [navigate, onHandled, request])
}
