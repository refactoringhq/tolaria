import { useEffect, useEffectEvent, useRef, type MouseEvent as ReactMouseEvent } from 'react'
import { useAppLocale } from '../hooks/useAppPreferences'
import { translate, type TranslationKey } from '../lib/i18n'
import { cn } from '../lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'

interface ResizeHandleProps {
  onResize: (delta: number) => void
  collapse?: { label: TranslationKey; action: () => void }
  overlay?: boolean
  testId?: string
}

interface ResizeGesture {
  lastX: number
  pendingDelta: number
  frame: number
  cursor: string
  userSelect: string
}

function useResizeGesture(onResize: ResizeHandleProps['onResize']) {
  const gesture = useRef<ResizeGesture | null>(null)
  const resized = useRef(false)
  const resize = useEffectEvent(onResize)

  useEffect(() => {
    function flush(current: ResizeGesture) {
      if (current.pendingDelta !== 0) resize(current.pendingDelta)
      current.pendingDelta = 0
      current.frame = 0
    }

    function handleMouseMove(event: MouseEvent) {
      const current = gesture.current
      if (!current || event.clientX === current.lastX) return
      resized.current = true
      current.pendingDelta += event.clientX - current.lastX
      current.lastX = event.clientX
      if (!current.frame) current.frame = requestAnimationFrame(() => flush(current))
    }

    function finishResize(commit: boolean) {
      const current = gesture.current
      if (!current) return
      gesture.current = null
      cancelAnimationFrame(current.frame)
      document.body.style.cursor = current.cursor
      document.body.style.userSelect = current.userSelect
      if (commit) flush(current)
    }

    const handleMouseUp = () => finishResize(true)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('blur', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('blur', handleMouseUp)
      finishResize(false)
    }
  }, [])

  function onMouseDown(event: ReactMouseEvent<HTMLElement>) {
    if (event.button !== 0) return
    event.preventDefault()
    const { style } = document.body
    resized.current = false
    gesture.current = {
      lastX: event.clientX,
      pendingDelta: 0,
      frame: 0,
      cursor: style.cursor,
      userSelect: style.userSelect,
    }
    style.cursor = 'col-resize'
    style.userSelect = 'none'
  }

  return { onMouseDown, resized }
}

function ResizeHint({ text }: { text: string }) {
  const [before, emphasis, after] = text.split(/<strong>([^<]+)<\/strong>/)
  return <>{before}{emphasis && <strong>{emphasis}</strong>}{after}</>
}

const KEYBOARD_DELTA: Record<string, number> = { ArrowLeft: -8, ArrowRight: 8 }

export function ResizeHandle({ onResize, collapse, overlay, testId }: ResizeHandleProps) {
  const locale = useAppLocale()
  const { onMouseDown, resized } = useResizeGesture(onResize)
  const dragHint = translate(locale, 'layout.dragToResize')
  const collapseLabel = collapse && translate(locale, collapse.label)
  const className = cn(
    'z-30 cursor-col-resize bg-transparent p-0',
    overlay ? 'absolute inset-y-0 left-0 h-auto min-h-0 w-2 rounded-none' : 'relative -ml-1 w-1 shrink-0 self-stretch',
  )
  return (
    <TooltipProvider delayDuration={400}>
      <Tooltip>
        <TooltipTrigger
          type="button"
          className={className}
          data-testid={testId}
          aria-label={collapseLabel ?? dragHint.replace(/<\/?strong>/g, '')}
          onMouseDown={onMouseDown}
          onClick={(event) => {
            if (event.detail === 0 || !resized.current) collapse?.action()
          }}
          onKeyDown={(event) => {
            const delta = KEYBOARD_DELTA[event.key]
            if (!delta) return
            event.preventDefault()
            onResize(delta)
          }}
        />
        <TooltipContent
          side={overlay ? 'left' : 'right'}
          sideOffset={8}
          data-panel-resize-tooltip=""
          className="border border-border bg-popover px-2.5 py-2 text-popover-foreground shadow-sm"
        >
          <div><ResizeHint text={dragHint} /></div>
          {collapse && <div className="mt-1"><ResizeHint text={translate(locale, 'layout.clickToCollapse')} /></div>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
