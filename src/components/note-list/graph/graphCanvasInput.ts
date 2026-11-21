import { type KeyboardEvent, type MouseEvent, type PointerEvent, type RefObject, useEffect, useMemo, useRef, useState } from 'react'
import { trackEvent } from '../../../lib/telemetry'
import { useLatestRef } from '../../../hooks/useLatestRef'
import type { VaultEntry } from '../../../types'
import { fitGraph, revealNodes, zoomGraph } from './graphCamera'
import type { LayoutController } from './graphLayoutClient'
import type { VisibleGraph } from './graphModel'
import type { GraphRenderer } from './graphRenderer'

/** A press that travels further than this pans (or drags) and never opens a note. */
const MAX_CLICK_TRAVEL_PX = 4
/** Leaving a node waits this long before un-hovering, so sliding to the next node never flickers. */
const HOVER_LEAVE_DELAY_MS = 80
const EDITOR_PANEL_SELECTOR = '.app__editor'
/** Escape anywhere leaves neighbour focus, except while typing or inside the editor, a menu or a dialog. */
const ESCAPE_EXEMPT_SELECTOR = `${EDITOR_PANEL_SELECTOR}, input, textarea, select, [contenteditable="true"], [role="dialog"], [role="menu"]`

type CanvasKeyAction = 'zoomIn' | 'zoomOut' | 'fit' | 'close'
type Point = { x: number; y: number }

/** Keys the graph answers while focus is inside it: zoom with + / -, fit with 0, leave focus and close the panel with Escape. */
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
  onNodeClick: (entry: VaultEntry, event: MouseEvent) => void
  onBackgroundClick: () => void
}

interface RevealSource {
  renderer: GraphRenderer | null
  stageRef: RefObject<HTMLDivElement | null>
  /** The open note, or the focused note and its neighbours. */
  revealed: readonly string[]
  panelOpen: boolean
}

export function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
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

/** A click on the canvas itself (not its buttons) that did not travel like a pan or a drag. */
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

/** Node clicks open (and focus) the note with the real click event; empty-canvas clicks leave focus. */
export function useCanvasClicks({ renderer, visible, onNodeClick, onBackgroundClick }: ClickTargets) {
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
      if (entry) onNodeClick(entry, event)
      else onBackgroundClick()
    },
  }
}

function nodePosition(renderer: GraphRenderer, node: string): Point | null {
  const graph = renderer.getGraph()
  return graph.hasNode(node) ? (graph.getNodeAttributes(node) as Point) : null
}

/**
 * Sigma moves a dragged node under the pointer; the simulation holds it there so its neighbours follow
 * and the rest of the graph reacts live, then lets it go on release (not pinned).
 */
export function useNodeDrag(renderer: GraphRenderer | null, layout: LayoutController | null, onDragStart: () => void) {
  useEffect(() => {
    if (!renderer || !layout) return
    const hold = ({ node }: { node: string }) => {
      const position = nodePosition(renderer, node)
      if (position) layout.hold(node, position.x, position.y)
    }
    const start = (payload: { node: string }) => {
      onDragStart()
      hold(payload)
    }
    const release = ({ node }: { node: string }) => {
      layout.release(node)
      trackEvent('graph_node_dragged', { node_count: renderer.getGraph().order })
    }
    renderer.on('nodeDragStart', start)
    renderer.on('nodeDrag', hold)
    renderer.on('nodeDragEnd', release)
    return () => {
      renderer.off('nodeDragStart', start)
      renderer.off('nodeDrag', hold)
      renderer.off('nodeDragEnd', release)
    }
  }, [layout, onDragStart, renderer])
}

/** The hovered node, with a short grace period on leave so moving between neighbours doesn't flash. */
export function useHoveredNode(renderer: GraphRenderer | null): string | null {
  const [hovered, setHovered] = useState<string | null>(null)
  useEffect(() => {
    if (!renderer) return
    let leaveTimer: ReturnType<typeof setTimeout> | null = null
    const clearLeave = () => {
      if (leaveTimer) clearTimeout(leaveTimer)
      leaveTimer = null
    }
    const enter = ({ node }: { node: string }) => {
      clearLeave()
      setHovered(node)
    }
    const leave = () => {
      clearLeave()
      leaveTimer = setTimeout(() => setHovered(null), HOVER_LEAVE_DELAY_MS)
    }
    renderer.on('enterNode', enter)
    renderer.on('leaveNode', leave)
    return () => {
      clearLeave()
      renderer.off('enterNode', enter)
      renderer.off('leaveNode', leave)
      setHovered(null)
    }
  }, [renderer])
  return hovered
}

/** Canvas pixels from the left edge that the slid-in editor panel leaves uncovered. */
function uncoveredCanvasWidth(stage: HTMLElement): number {
  const stageRect = stage.getBoundingClientRect()
  const panel = document.querySelector<HTMLElement>(EDITOR_PANEL_SELECTOR)
  if (!panel?.parentElement) return stageRect.width
  const panelLeft = panel.parentElement.getBoundingClientRect().right - panel.offsetWidth
  return Math.min(stageRect.width, panelLeft - stageRect.left)
}

/** Keeps the open note (or the focused neighbourhood) in view: when the panel opens over it, the camera eases it into the uncovered part. */
export function useRevealOpenNote({ renderer, stageRef, revealed, panelOpen }: RevealSource) {
  const key = revealed.join('\n')
  useEffect(() => {
    const stage = stageRef.current
    if (!renderer || !stage || !panelOpen || !key) return
    revealNodes(renderer, key.split('\n'), uncoveredCanvasWidth(stage))
  }, [key, panelOpen, renderer, stageRef])
}

function escapeIsForUs(event: globalThis.KeyboardEvent): boolean {
  if (event.key !== 'Escape' || event.defaultPrevented) return false
  return !(event.target instanceof Element && event.target.closest(ESCAPE_EXEMPT_SELECTOR))
}

/** While a note is focused, Escape leaves the focus even when keyboard focus is not on the canvas. */
export function useEscapeLeavesFocus(active: boolean, leave: () => void) {
  const leaveRef = useLatestRef(leave)
  useEffect(() => {
    if (!active) return
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (escapeIsForUs(event)) leaveRef.current()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [active, leaveRef])
}
