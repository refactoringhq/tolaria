import { type LabelBox, type LabelCandidate, type LabelSide, labelZoomOpacity, placeLabels } from './graphLabelPlacement'
import type { LabelEmphasis } from './graphLabelRanking'
import type { GraphNodeModel } from './graphModel'
import type { GraphRenderer } from './graphRenderer'

/** A label chip element. */
export type LabelChip = HTMLElement

/** Per-frame label placement: reads node positions from sigma, places chips, and writes only what changed. */

export function labelOrder(ranked: readonly GraphNodeModel[], forced: readonly string[]): string[] {
  const forcedSet = new Set(forced)
  return [...forced, ...ranked.map((node) => node.id).filter((id) => !forcedSet.has(id))]
}

/** Label text never changes after mount, so each chip is measured once (kept in its dataset), not every frame. */
function labelWidth(label: LabelChip): number {
  const known = Number(label.dataset.width)
  if (label.dataset.width !== undefined && Number.isFinite(known)) return known
  const width = label.offsetWidth
  label.dataset.width = String(width)
  return width
}

function emphasisOf(id: string, emphasis: LabelEmphasis): string {
  if (id === emphasis.hovered) return 'hover'
  return emphasis.strong && !emphasis.strong.has(id) ? 'dim' : ''
}

/** What was last written to a chip, so a frame only touches the DOM where something changed. */
export interface ChipState {
  transform: string
  opacity: string
}

interface FrameSource {
  renderer: GraphRenderer
  chips: Map<string, LabelChip>
  written: WeakMap<LabelChip, ChipState | null>
  order: readonly string[]
  forced: ReadonlySet<string>
}

/** Labels hang below the node, so a node this far outside the canvas can't have a visible label. */
const OFFSCREEN_MARGIN_PX = 200

function withinMargin(value: number, size: number): boolean {
  return value > -OFFSCREEN_MARGIN_PX && value < size + OFFSCREEN_MARGIN_PX
}

function isNearViewport(point: { x: number; y: number }, viewport: { width: number; height: number }): boolean {
  return withinMargin(point.x, viewport.width) && withinMargin(point.y, viewport.height)
}

interface CandidateContext extends FrameSource {
  viewport: { width: number; height: number }
  zoomScale: number
}

/** The node's label candidate this frame, or null when it has no chip, isn't drawn, or is far off-screen. */
function candidateFor(context: CandidateContext, id: string): LabelCandidate | null {
  const { renderer, chips, forced } = context
  const graph = renderer.getGraph()
  const chip = chips.get(id)
  const display = graph.hasNode(id) ? renderer.getNodeDisplayData(id) : undefined
  if (!chip || !display) return null
  const point = renderer.graphToViewport(graph.getNodeAttributes(id) as { x: number; y: number })
  const isForced = forced.has(id)
  if (!isForced && !isNearViewport(point, context.viewport)) return null
  return { id, x: point.x, y: point.y, radius: display.size / context.zoomScale, width: labelWidth(chip), forced: isForced }
}

/** Candidates in priority order; zoomed out past the fade only the forced ones (which come first) are needed. */
function frameCandidates(source: FrameSource, forcedOnly: boolean): LabelCandidate[] {
  const { renderer, order, forced } = source
  const context = { ...source, viewport: renderer.getDimensions(), zoomScale: renderer.getSetting('zoomToSizeRatioFunction')(renderer.getCamera().ratio) }
  const ids = forcedOnly ? order.filter((id) => forced.has(id)) : order
  return ids.map((id) => candidateFor(context, id)).filter((candidate): candidate is LabelCandidate => candidate !== null)
}

/**
 * An unplaced chip leaves layout entirely (display: none), so a thousand hidden chips cost nothing per
 * frame. It is measured first: every chip mounts laid out but invisible, and its width is cached.
 */
function hideChip(chip: LabelChip, written: WeakMap<LabelChip, ChipState | null>) {
  if (written.get(chip) !== null) chip.style.display = 'none'
  written.set(chip, null)
}

function showChip(chip: LabelChip, next: ChipState, written: WeakMap<LabelChip, ChipState | null>) {
  const previous = written.get(chip) ?? null
  if (!previous) {
    chip.style.display = ''
    chip.style.visibility = 'visible'
  }
  if (previous?.transform !== next.transform) chip.style.transform = next.transform
  if (previous?.opacity !== next.opacity) chip.style.opacity = next.opacity
  written.set(chip, next)
}

function writeChip(chip: LabelChip, box: LabelBox | undefined, opacity: number, written: WeakMap<LabelChip, ChipState | null>) {
  if (box) showChip(chip, { transform: `translate(${box.left}px, ${box.top}px)`, opacity: String(opacity) }, written)
  else hideChip(chip, written)
}

export interface PlaceSource extends FrameSource {
  threshold: number
  /** Each forced label's side last frame. */
  sides: Map<string, LabelSide>
}

/** Reads every unmeasured chip's width in one pass, before any write, so the browser lays out once. */
function measureChips(chips: Map<string, LabelChip>) {
  for (const chip of chips.values()) if (chip.dataset.width === undefined && chip.style.display !== 'none') labelWidth(chip)
}

export function placeFrame(source: PlaceSource) {
  const { renderer, chips, forced, written } = source
  measureChips(chips)
  const opacity = labelZoomOpacity(renderer.getCamera().ratio, source.threshold)
  const candidates = frameCandidates(source, opacity === 0)
  const placed = placeLabels(candidates, candidates, { viewport: renderer.getDimensions(), allowUnforced: opacity > 0, sides: source.sides })
  for (const [id, chip] of chips) writeChip(chip, placed.get(id), forced.has(id) ? 1 : opacity, written)
}

/** Hover grows a chip and dims the others through CSS transitions; set once per emphasis change, not per frame. */
export function markEmphasis(chips: Map<string, LabelChip>, emphasis: LabelEmphasis) {
  for (const [id, chip] of chips) {
    const state = emphasisOf(id, emphasis)
    if ((chip.dataset.emphasis ?? '') !== state) chip.dataset.emphasis = state
  }
}

export function chipMap(container: Element): Map<string, LabelChip> {
  const chips = new Map<string, LabelChip>()
  for (const child of container.children) if (child instanceof HTMLElement && child.dataset.node) chips.set(child.dataset.node, child)
  return chips
}
