import type Graph from 'graphology'
import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { GraphSettings } from '../../../collections/collectionTypes'
import { useLatestRef } from '../../../hooks/useLatestRef'
import type { VaultEntry } from '../../../types'
import { fitGraph } from './graphCamera'
import { prefersReducedMotion } from './graphCanvasInput'
import { emphasisTarget, neighbourhood, neighboursIn, strongNodes } from './graphEmphasis'
import { EmphasisAnimator } from './graphEmphasisAnimator'
import { createLayoutController, FIRST_LAYOUT_ALPHA, type LayoutController, RELAYOUT_ALPHA } from './graphLayoutClient'
import type { VisibleGraph } from './graphModel'
import { readGraphPalette } from './graphPalette'
import { createGraphRenderer, type GraphDisplay, type GraphRenderer, type GraphRendererColors } from './graphRenderer'
import type { GraphForces } from './graphSimulation'
import { syncGraph } from './graphSync'
import type { LabelEmphasis } from './graphLabelRanking'

function readColors(stage: HTMLElement): GraphRendererColors {
  const palette = readGraphPalette(stage, {})
  palette.dispose()
  return { accent: palette.accent }
}

export function displayOf(settings: GraphSettings): GraphDisplay {
  return { nodeSizeScale: settings.nodeSizeScale, linkThickness: settings.linkThickness, showArrows: settings.showArrows }
}

export function forcesOf(settings: GraphSettings): GraphForces {
  return { centerForce: settings.centerForce, repelForce: settings.repelForce, linkForce: settings.linkForce, linkDistance: settings.linkDistance }
}

/**
 * One sigma renderer per mounted canvas. A theme switch or a display setting only refreshes: colors and
 * sizes are read by the styles on every refresh, so the WebGL context is never rebuilt.
 */
export function useGraphRenderer(stageRef: RefObject<HTMLDivElement | null>, graph: Graph, theme: string, display: GraphDisplay) {
  const [renderer, setRenderer] = useState<GraphRenderer | null>(null)
  const colorsRef = useRef<GraphRendererColors>({ accent: '' })
  const displayRef = useLatestRef(display)
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    colorsRef.current = readColors(stage)
    const created = createGraphRenderer(graph, stage, { colors: () => colorsRef.current, display: () => displayRef.current })
    setRenderer(created)
    return () => {
      created.kill()
      setRenderer(null)
    }
  }, [displayRef, graph, stageRef])
  const displayKey = JSON.stringify(display)
  useEffect(() => {
    const stage = stageRef.current
    if (!stage || !renderer) return
    colorsRef.current = readColors(stage)
    renderer.refresh()
  }, [displayKey, renderer, stageRef, theme])
  return renderer
}

interface LayoutSource {
  graph: Graph
  renderer: GraphRenderer | null
  forces: GraphForces
}

/**
 * The live layout for the canvas lifetime. While the first layout settles the camera keeps the whole graph
 * in view, until the user takes over (any press or wheel on the canvas) or the graph comes to rest.
 */
export function useLiveLayout({ graph, renderer, forces }: LayoutSource) {
  const autoFitRef = useRef(true)
  const rendererRef = useLatestRef(renderer)
  const [layout, setLayout] = useState<LayoutController | null>(null)
  const forcesRef = useRef(forces)
  useEffect(() => {
    const controller = createLayoutController(graph, forcesRef.current, (resting) => {
      if (autoFitRef.current && rendererRef.current) fitGraph(rendererRef.current, true)
      if (resting) autoFitRef.current = false
    })
    setLayout(controller)
    return () => controller.dispose()
  }, [graph, rendererRef])
  const forcesKey = JSON.stringify(forces)
  useEffect(() => {
    if (forcesKey === JSON.stringify(forcesRef.current)) return
    forcesRef.current = JSON.parse(forcesKey) as GraphForces
    layout?.setForces(forcesRef.current)
  }, [forcesKey, layout])
  const stopAutoFit = useCallback(() => {
    autoFitRef.current = false
  }, [])
  return { layout, stopAutoFit }
}

interface GraphSyncSource {
  stageRef: RefObject<HTMLDivElement | null>
  graph: Graph
  visible: VisibleGraph
  typeEntryMap: Record<string, VaultEntry>
  theme: string
  layout: LayoutController | null
}

/** Mirrors the visible notes into the graph and reheats the layout when notes or links come or go. */
export function useGraphSync({ stageRef, graph, visible, typeEntryMap, theme, layout }: GraphSyncSource) {
  const loaded = useRef(false)
  useEffect(() => {
    const stage = stageRef.current
    if (!stage || !layout) return
    const palette = readGraphPalette(stage, typeEntryMap)
    const changed = syncGraph(graph, visible, palette)
    palette.dispose()
    if (!changed && loaded.current) return
    layout.load(loaded.current ? RELAYOUT_ALPHA : FIRST_LAYOUT_ALPHA)
    loaded.current = true
  }, [graph, layout, stageRef, theme, typeEntryMap, visible])
}

interface EmphasisSource {
  graph: Graph
  hovered: string | null
  focused: string | null
  visible: VisibleGraph
}

/** Animates hover and focus emphasis into the graph and returns what the labels need to follow it. */
export function useGraphEmphasis({ graph, hovered, focused, visible }: EmphasisSource): LabelEmphasis {
  const animator = useMemo(() => new EmphasisAnimator(graph), [graph])
  // Re-derived from `visible`, so the sets follow notes and links that come or go under a hover or focus.
  const emphasis = useMemo<LabelEmphasis>(() => {
    const shown = new Set(visible.nodes.map((node) => node.id))
    const neighbours = neighboursIn(visible.edges)
    const subject = { hovered: hovered && shown.has(hovered) ? hovered : null, focused: focused && shown.has(focused) ? focused : null }
    return {
      hovered: subject.hovered,
      focused: subject.focused ? neighbourhood(neighbours, subject.focused) : null,
      strong: strongNodes(neighbours, subject),
    }
  }, [focused, hovered, visible])
  useEffect(() => {
    animator.animateTo(emphasisTarget(emphasis.strong, emphasis.hovered), prefersReducedMotion())
  }, [animator, emphasis])
  useEffect(() => () => animator.stop(), [animator])
  return emphasis
}
