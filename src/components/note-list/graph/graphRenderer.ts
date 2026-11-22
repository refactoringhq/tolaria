import type Graph from 'graphology'
import type { Attributes } from 'graphology-types'
import Sigma from 'sigma'
import { extremityArrow, layerDashed } from 'sigma/rendering'
import { MAX_CAMERA_RATIO, MIN_CAMERA_RATIO } from './graphCamera'
import { mixColors } from './graphPalette'

export type GraphRenderer = Sigma

/** The display settings the WebGL styles read on every refresh. */
export interface GraphDisplay {
  nodeSizeScale: number
  linkThickness: number
  showArrows: boolean
}

/** Theme colors the styles read on every refresh, so a theme switch never rebuilds the renderer. */
export interface GraphRendererColors {
  /** The hovered note's fill. */
  accent: string
}

export interface GraphRendererOptions {
  colors: () => GraphRendererColors
  display: () => GraphDisplay
}

const SELECTED_NODE_GROWTH = 1.5
/** The hovered note grows by up to this much as its accent fades in. */
const HOVER_NODE_GROWTH = 0.3

function numberAttribute(attributes: Attributes, key: string, fallback: number): number {
  const value: unknown = Reflect.get(attributes, key)
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function nodeSize(attributes: Attributes, display: GraphDisplay): number {
  const accent = numberAttribute(attributes, 'accent', 0)
  const growth = (attributes.highlighted ? SELECTED_NODE_GROWTH : 1) * (1 + HOVER_NODE_GROWTH * accent)
  return numberAttribute(attributes, 'size', 6) * display.nodeSizeScale * growth
}

function nodeColor(attributes: Attributes, accentColor: string): string {
  const accent = numberAttribute(attributes, 'accent', 0)
  const color = String(attributes.color ?? 'rgb(128, 128, 128)')
  return accent > 0 ? mixColors(color, accentColor, accent) : color
}

/** Arrowheads point the way the links go: at the target, the source, or both ends. */
function edgeEnd(attributes: Attributes, display: GraphDisplay, end: 'head' | 'tail'): string {
  if (!display.showArrows) return 'none'
  const direction = attributes.direction ?? 'forward'
  const wanted = end === 'head' ? 'forward' : 'backward'
  return direction === 'both' || direction === wanted ? 'arrow' : 'none'
}

/**
 * Sigma on WebGL. One dashed edge layer draws both edge kinds: relationship edges fill their gaps with the
 * edge color (solid), wiki-link edges leave them transparent (dashed). Graph coordinates are used as they
 * are (no automatic rescale), so the live layout can grow and shrink without the view jumping and a
 * dragged node stays exactly under the pointer. Per-item `fade` and `accent` attributes carry the
 * animated hover and focus emphasis; labels are an HTML overlay, so sigma's own labels stay off.
 */
export function createGraphRenderer(graph: Graph, container: HTMLElement, options: GraphRendererOptions): GraphRenderer {
  return new Sigma(graph, container, {
    primitives: {
      edges: {
        variables: { gapColor: { type: 'color', default: 'rgba(0, 0, 0, 0)' } },
        extremities: [extremityArrow({ lengthRatio: 4, widthRatio: 3.5 })],
        layers: [layerDashed({ gapColor: { attribute: 'gapColor' }, dashSize: { value: 5 }, gapSize: { value: 4 }, solidExtremities: true })],
      },
    },
    styles: {
      nodes: {
        x: { attribute: 'x' },
        y: { attribute: 'y' },
        color: (attributes) => nodeColor(attributes, options.colors().accent),
        size: (attributes) => nodeSize(attributes, options.display()),
        opacity: (attributes) => numberAttribute(attributes, 'fade', 1),
        depth: (attributes) => (numberAttribute(attributes, 'accent', 0) > 0 || attributes.highlighted ? 'topNodes' : 'nodes'),
        // The open note is drawn larger, with no ring around it.
        backdropVisibility: 'hidden',
        labelVisibility: 'hidden',
        cursor: 'pointer',
      },
      edges: {
        color: { attribute: 'color' },
        size: (attributes) => numberAttribute(attributes, 'size', 1) * options.display().linkThickness,
        gapColor: { attribute: 'gapColor' },
        opacity: (attributes) => numberAttribute(attributes, 'fade', 1),
        head: (attributes) => edgeEnd(attributes, options.display(), 'head'),
        tail: (attributes) => edgeEnd(attributes, options.display(), 'tail'),
      },
      stage: {
        cursor: (state) => (state.isPanning || state.isDragging ? 'grabbing' : 'grab'),
      },
    },
    settings: {
      renderLabels: false,
      renderEdgeLabels: false,
      minCameraRatio: MIN_CAMERA_RATIO,
      maxCameraRatio: MAX_CAMERA_RATIO,
      zoomDuration: 280,
      stagePadding: 40,
      autoRescale: false,
      // Sizes are screen pixels (growing gently with zoom), not graph units.
      itemSizesReference: 'screen',
      enableNodeDrag: true,
    },
  })
}
