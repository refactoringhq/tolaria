import { useEffect, useState } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { isLinux } from '../utils/platform'
import { useDragRegion } from '../hooks/useDragRegion'
import { LinuxMenuButton } from './LinuxMenuButton'

export const LINUX_TITLEBAR_HEIGHT = 32
const RESIZE_EDGE = 6

type ResizeDirection =
  | 'North' | 'South' | 'East' | 'West'
  | 'NorthEast' | 'NorthWest' | 'SouthEast' | 'SouthWest'

const RESIZE_HANDLES: ReadonlyArray<{
  direction: ResizeDirection
  cursor: string
  style: React.CSSProperties
}> = [
  { direction: 'North',     cursor: 'ns-resize',   style: { top: 0,    left: RESIZE_EDGE,    right: RESIZE_EDGE,    height: RESIZE_EDGE } },
  { direction: 'South',     cursor: 'ns-resize',   style: { bottom: 0, left: RESIZE_EDGE,    right: RESIZE_EDGE,    height: RESIZE_EDGE } },
  { direction: 'West',      cursor: 'ew-resize',   style: { top: RESIZE_EDGE, bottom: RESIZE_EDGE, left: 0,    width: RESIZE_EDGE } },
  { direction: 'East',      cursor: 'ew-resize',   style: { top: RESIZE_EDGE, bottom: RESIZE_EDGE, right: 0,   width: RESIZE_EDGE } },
  { direction: 'NorthWest', cursor: 'nwse-resize', style: { top: 0,    left: 0,    width: RESIZE_EDGE, height: RESIZE_EDGE } },
  { direction: 'NorthEast', cursor: 'nesw-resize', style: { top: 0,    right: 0,   width: RESIZE_EDGE, height: RESIZE_EDGE } },
  { direction: 'SouthWest', cursor: 'nesw-resize', style: { bottom: 0, left: 0,    width: RESIZE_EDGE, height: RESIZE_EDGE } },
  { direction: 'SouthEast', cursor: 'nwse-resize', style: { bottom: 0, right: 0,   width: RESIZE_EDGE, height: RESIZE_EDGE } },
]

export function LinuxTitlebar() {
  const { onMouseDown } = useDragRegion()
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    if (!isLinux()) return
    const win = getCurrentWindow()
    win.isMaximized().then(setMaximized).catch(() => {})
    const promise = win.onResized(() => {
      win.isMaximized().then(setMaximized).catch(() => {})
    })
    return () => { promise.then((unlisten) => unlisten()).catch(() => {}) }
  }, [])

  if (!isLinux()) return null

  const win = getCurrentWindow()

  return (
    <>
      <ResizeHandles />
      <div
        className="fixed top-0 left-0 right-0 z-[1000] flex items-center justify-between border-b border-border bg-background select-none"
        style={{ height: LINUX_TITLEBAR_HEIGHT }}
        onMouseDown={onMouseDown}
        onDoubleClick={() => { win.toggleMaximize().catch(() => {}) }}
        data-testid="linux-titlebar"
      >
        <div className="flex h-full items-center" data-no-drag>
          <LinuxMenuButton />
        </div>
        <div className="flex h-full items-center" data-no-drag>
          <TitlebarButton ariaLabel="Minimize" onClick={() => win.minimize().catch(() => {})}>
            <MinimizeIcon />
          </TitlebarButton>
          <TitlebarButton
            ariaLabel={maximized ? 'Restore' : 'Maximize'}
            onClick={() => win.toggleMaximize().catch(() => {})}
          >
            {maximized ? <RestoreIcon /> : <MaximizeIcon />}
          </TitlebarButton>
          <TitlebarButton ariaLabel="Close" onClick={() => win.close().catch(() => {})} variant="close">
            <CloseIcon />
          </TitlebarButton>
        </div>
      </div>
    </>
  )
}

function ResizeHandles() {
  const startResize = (direction: ResizeDirection) => (e: React.MouseEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    getCurrentWindow().startResizeDragging(direction).catch(() => {})
  }

  return (
    <>
      {RESIZE_HANDLES.map(({ direction, cursor, style }) => (
        <div
          key={direction}
          className="fixed z-[1001]"
          style={{ ...style, cursor }}
          onMouseDown={startResize(direction)}
          data-no-drag
          aria-hidden
        />
      ))}
    </>
  )
}

function TitlebarButton({
  children,
  onClick,
  ariaLabel,
  variant,
}: {
  children: React.ReactNode
  onClick: () => void
  ariaLabel: string
  variant?: 'close'
}) {
  const hoverClass = variant === 'close'
    ? 'hover:bg-red-500 hover:text-white'
    : 'hover:bg-foreground/10'
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      style={{ width: 46 }}
      className={`flex h-full items-center justify-center text-foreground/70 transition-colors duration-100 ${hoverClass}`}
    >
      {children}
    </button>
  )
}

function MinimizeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
      <line x1="2.5" y1="6" x2="9.5" y2="6" />
    </svg>
  )
}

function MaximizeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
      <rect x="2.5" y="2.5" width="7" height="7" rx="0.5" />
    </svg>
  )
}

function RestoreIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
      <rect x="2.5" y="3.8" width="6" height="6" rx="0.5" />
      <path d="M4 3.8 V 2.5 H 9.5 V 8" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
      <line x1="3" y1="3" x2="9" y2="9" />
      <line x1="9" y1="3" x2="3" y2="9" />
    </svg>
  )
}
