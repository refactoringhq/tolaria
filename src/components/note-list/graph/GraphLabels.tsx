import { type ComponentType, memo, type SVGAttributes, useEffect, useMemo, useRef } from 'react'
import type { VaultEntry } from '../../../types'
import { getTypeColor } from '../../../utils/typeColors'
import { NoteTitleIcon } from '../../NoteTitleIcon'
import { getTypeIcon } from '../../note-item/typeIcon'
import { type GraphNodeModel, labelledNodes } from './graphModel'
import type { GraphRenderer } from './graphRenderer'

const LABEL_GAP_PX = 4

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

function placeLabels(renderer: GraphRenderer, container: HTMLElement) {
  const graph = renderer.getGraph()
  for (const label of container.children) {
    if (!(label instanceof HTMLElement)) continue
    const node = label.dataset.node
    const display = node && graph.hasNode(node) ? renderer.getNodeDisplayData(node) : undefined
    if (!node || !display) {
      label.style.visibility = 'hidden'
      continue
    }
    const point = renderer.graphToViewport(graph.getNodeAttributes(node) as { x: number; y: number })
    label.style.visibility = 'visible'
    label.style.transform = `translate(${point.x}px, ${point.y + display.size + LABEL_GAP_PX}px) translateX(-50%)`
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
