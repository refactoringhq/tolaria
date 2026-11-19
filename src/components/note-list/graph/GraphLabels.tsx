import { type ComponentType, memo, type SVGAttributes, useEffect, useMemo, useRef } from 'react'
import type { VaultEntry } from '../../../types'
import { getTypeColor } from '../../../utils/typeColors'
import { NoteTitleIcon } from '../../NoteTitleIcon'
import { getTypeIcon } from '../../note-item/typeIcon'
import { type GraphNodeModel, labelledNodes } from './graphModel'
import type { GraphRenderer } from './graphRenderer'

const LABEL_GAP_PX = 5
const LABEL_HEIGHT_PX = 18

interface GraphLabelsProps {
  renderer: GraphRenderer
  nodes: GraphNodeModel[]
  typeEntryMap: Record<string, VaultEntry>
  selectedNotePath: string | null
}

interface TypeGlyph {
  Icon: ComponentType<SVGAttributes<SVGSVGElement>>
  color: string
}

function typeGlyph(entry: VaultEntry, typeEntryMap: Record<string, VaultEntry>): TypeGlyph {
  const typeEntry = entry.isA ? Reflect.get(typeEntryMap, entry.isA) as VaultEntry | undefined : undefined
  return { Icon: getTypeIcon(entry.isA, typeEntry?.icon), color: getTypeColor(entry.isA, typeEntry?.color) }
}

/** The note's own icon, or its type icon in the type color, like a list row. */
const LabelIcon = memo(function LabelIcon({ icon, glyph }: { icon: string | null; glyph: TypeGlyph }) {
  if (icon) return <NoteTitleIcon icon={icon} size={12} className="graph-label__icon" testId="graph-label-icon" />
  const { Icon, color } = glyph
  return <Icon width={12} height={12} className="graph-label__icon" style={{ color }} data-testid="graph-label-icon" />
})

interface LabelBox {
  left: number
  top: number
  right: number
  bottom: number
}

/** Label text never changes after mount, so each chip is measured once (kept in its dataset), not every frame. */
function labelWidth(label: HTMLElement): number {
  const known = Number(label.dataset.width)
  if (label.dataset.width !== undefined && Number.isFinite(known)) return known
  const width = label.offsetWidth
  label.dataset.width = String(width)
  return width
}

function overlaps(left: LabelBox, right: LabelBox): boolean {
  return left.left < right.right && right.left < left.right && left.top < right.bottom && right.top < left.bottom
}

/** Where a node's chip goes: centred under the node, clear of its rendered radius at the current zoom. */
function labelBox(renderer: GraphRenderer, node: string | undefined, width: number): LabelBox | null {
  const graph = renderer.getGraph()
  const display = node && graph.hasNode(node) ? renderer.getNodeDisplayData(node) : undefined
  if (!node || !display) return null
  const point = renderer.graphToViewport(graph.getNodeAttributes(node) as { x: number; y: number })
  const zoomScale = renderer.getSetting('zoomToSizeRatioFunction')(renderer.getCamera().ratio)
  const top = point.y + display.size / zoomScale + LABEL_GAP_PX
  return { left: point.x - width / 2, top, right: point.x + width / 2, bottom: top + LABEL_HEIGHT_PX }
}

/** The open note's chip first, then by rank; a chip that would cover an earlier one stays hidden this frame. */
function orderedLabels(container: HTMLElement): HTMLElement[] {
  const labels = [...container.children].filter((child): child is HTMLElement => child instanceof HTMLElement)
  return [...labels.filter((label) => label.dataset.selected === 'true'), ...labels.filter((label) => label.dataset.selected !== 'true')]
}

function placeLabels(renderer: GraphRenderer, container: HTMLElement) {
  const placed: LabelBox[] = []
  for (const label of orderedLabels(container)) {
    const box = labelBox(renderer, label.dataset.node, labelWidth(label))
    const visible = box !== null && !placed.some((other) => overlaps(other, box))
    label.style.visibility = visible ? 'visible' : 'hidden'
    if (!box || !visible) continue
    placed.push(box)
    label.style.transform = `translate(${box.left}px, ${box.top}px)`
  }
}

/**
 * Title chips under the nodes, kept in place after every sigma frame by moving the DOM directly
 * (no React render per frame). The layer ignores the pointer so wheel zoom and drag reach the canvas.
 */
export function GraphLabels({ renderer, nodes, typeEntryMap, selectedNotePath }: GraphLabelsProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const labelled = useMemo(() => labelledNodes(nodes, selectedNotePath), [nodes, selectedNotePath])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const place = () => placeLabels(renderer, container)
    place()
    renderer.on('afterRender', place)
    return () => {
      renderer.off('afterRender', place)
    }
  }, [labelled, renderer])

  return (
    <div ref={containerRef} className="graph-labels" aria-hidden="true" data-testid="graph-labels">
      {labelled.map(({ id, entry }) => (
        <div key={id} className="graph-label" data-node={id} data-selected={id === selectedNotePath ? 'true' : undefined} data-testid="graph-label">
          <LabelIcon icon={entry.icon} glyph={typeGlyph(entry, typeEntryMap)} />
          <span className="graph-label__title">{entry.title}</span>
        </div>
      ))}
    </div>
  )
}
