import { type KeyboardEvent, type MouseEvent, type PointerEvent, type RefObject, useEffect, useMemo, useRef } from 'react'
import type { VaultEntry } from '../../../types'
import type { VisibleGraph } from './graphModel'
import { fitGraph, type GraphRenderer, revealNode, zoomGraph } from './graphRenderer'

/** A press that travels further than this pans the canvas and never opens a note. */
const MAX_CLICK_TRAVEL_PX = 4
const EDITOR_PANEL_SELECTOR = '.app__editor'

type CanvasKeyAction = 'zoomIn' | 'zoomOut' | 'fit' | 'close'
type Point = { x: number; y: number }

/** Keys the graph answers while focus is inside it: zoom with + / -, fit with 0, close the editor panel with Escape. */
const CANVAS_KEYS = new Map<string, CanvasKeyAction>([
  ['+', 'zoomIn'],
  ['=', 'zoomIn'],
  ['-', 'zoomOut'],
  ['0', 'fit'],
  ['Escape', 'close'],
])

interface ClickTargets {
  renderer: GraphRenderer | null
  visible: VisibleGraph
  onOpen: (entry: VaultEntry, event: MouseEvent) => void
  onBackgroundClick: () => void
}

interface RevealSource {
  renderer: GraphRenderer | null
  stageRef: RefObject<HTMLDivElement | null>
  selectedNotePath: string | null
  panelOpen: boolean
}

function runKeyAction(action: CanvasKeyAction, renderer: GraphRenderer, onBackgroundClick: () => void) {
  if (action === 'zoomIn') zoomGraph(renderer, 'in')
  else if (action === 'zoomOut') zoomGraph(renderer, 'out')
  else if (action === 'fit') fitGraph(renderer)
  else onBackgroundClick()
}

export function canvasKeyHandler(renderer: GraphRenderer | null, onBackgroundClick: () => void) {
  return (event: KeyboardEvent) => {
    const action = CANVAS_KEYS.get(event.key)
    if (!action || !renderer || event.metaKey || event.ctrlKey || event.altKey) return
    event.preventDefault()
    runKeyAction(action, renderer, onBackgroundClick)
  }
}

/** A click on the canvas itself (not its buttons) that did not travel like a pan. */
function isCanvasClick(start: Point | null, event: MouseEvent): start is Point {
  if (event.target instanceof Element && event.target.closest('button')) return false
  return start !== null && Math.hypot(event.clientX - start.x, event.clientY - start.y) <= MAX_CLICK_TRAVEL_PX
}

/** Remembers which node (if any) the current press started on, as sigma reports it. */
function usePressedNode(renderer: GraphRenderer | null) {
  const pressedNodeRef = useRef<string | null>(null)
  useEffect(() => {
    if (!renderer) return
    const onDownNode = ({ node }: { node: string }) => { pressedNodeRef.current = node }
    const onDownStage = () => { pressedNodeRef.current = null }
    renderer.on('downNode', onDownNode)
    renderer.on('downStage', onDownStage)
    return () => {
      renderer.off('downNode', onDownNode)
      renderer.off('downStage', onDownStage)
    }
  }, [renderer])
  return pressedNodeRef
}

/** Node clicks open the note with the real click event (modifiers included); empty-canvas clicks close the panel. */
export function useCanvasClicks({ renderer, visible, onOpen, onBackgroundClick }: ClickTargets) {
  const pressedNodeRef = usePressedNode(renderer)
  const pressStartRef = useRef<Point | null>(null)
  const entries = useMemo(() => new Map(visible.nodes.map((node) => [node.id, node.entry])), [visible.nodes])
  return {
    onPointerDown: (event: PointerEvent) => { pressStartRef.current = { x: event.clientX, y: event.clientY } },
    onClick: (event: MouseEvent) => {
      const start = pressStartRef.current
      const entry = entries.get(pressedNodeRef.current ?? '')
      pressStartRef.current = null
      pressedNodeRef.current = null
      if (!isCanvasClick(start, event)) return
      if (entry) onOpen(entry, event)
      else onBackgroundClick()
    },
  }
}

/** Canvas pixels from the left edge that the slid-in editor panel leaves uncovered. */
function uncoveredCanvasWidth(stage: HTMLElement): number {
  const stageRect = stage.getBoundingClientRect()
  const panel = document.querySelector<HTMLElement>(EDITOR_PANEL_SELECTOR)
  if (!panel?.parentElement) return stageRect.width
  const panelLeft = panel.parentElement.getBoundingClientRect().right - panel.offsetWidth
  return Math.min(stageRect.width, panelLeft - stageRect.left)
}

/** Keeps the open note visible: when the panel opens over it, the camera pans it into the uncovered part. */
export function useRevealOpenNote({ renderer, stageRef, selectedNotePath, panelOpen }: RevealSource) {
  useEffect(() => {
    const stage = stageRef.current
    if (!renderer || !stage || !panelOpen || !selectedNotePath) return
    revealNode(renderer, selectedNotePath, uncoveredCanvasWidth(stage))
  }, [panelOpen, renderer, selectedNotePath, stageRef])
}
