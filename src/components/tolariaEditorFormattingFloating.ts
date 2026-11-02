import { flip, offset, shift } from '@floating-ui/dom'
import type { FloatingUIOptions } from '@blocknote/react'

const FORMATTER_VIEWPORT_PADDING_PX = 8
type TolariaFloatingOptions = NonNullable<FloatingUIOptions['useFloatingOptions']>
type TolariaFloatingMiddleware = NonNullable<TolariaFloatingOptions['middleware']>[number]

function viewportClampMiddleware(): TolariaFloatingMiddleware {
  return {
    name: 'tolariaViewportClamp',
    fn({ x, rects }: { rects: { floating: { width: number } }; x: number }) {
      const viewportWidth = window.visualViewport?.width ?? window.innerWidth
      const minX = FORMATTER_VIEWPORT_PADDING_PX
      const maxX = Math.max(
        minX,
        viewportWidth - rects.floating.width - FORMATTER_VIEWPORT_PADDING_PX,
      )

      return {
        x: Math.min(Math.max(x, minX), maxX),
      }
    },
  }
}

export function withViewportSafeMiddleware(
  options?: TolariaFloatingOptions,
): TolariaFloatingOptions {
  return {
    ...options,
    middleware: [
      offset(10),
      shift(),
      flip(),
      ...(options?.middleware ?? []),
      viewportClampMiddleware(),
    ],
  }
}
