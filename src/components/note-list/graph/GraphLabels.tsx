import { type ComponentType, memo, type SVGAttributes, useEffect, useMemo, useRef } from 'react'
import type { VaultEntry } from '../../../types'
import { getTypeColor } from '../../../utils/typeColors'
import { NoteTitleIcon } from '../../NoteTitleIcon'
import { getTypeIcon } from '../../note-item/typeIcon'
import { chipMap, type ChipState, type LabelChip, labelOrder, markEmphasis, type PlaceSource, placeFrame } from './graphLabelFrame'
import type { LabelSide } from './graphLabelPlacement'
import { forcedLabels, LABEL_DOM_LIMIT, type LabelEmphasis, labelledNodes, rankLabels } from './graphLabelRanking'
import type { GraphNodeModel } from './graphModel'
import type { GraphRenderer } from './graphRenderer'

interface GraphLabelsProps {
  renderer: GraphRenderer
  nodes: GraphNodeModel[]
  typeEntryMap: Record<string, VaultEntry>
  selectedNotePath: string | null
  emphasis: LabelEmphasis
  textFadeThreshold: number
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

/**
 * Title chips under the nodes, placed after every sigma frame by moving the DOM directly (no React render
 * per frame). Labels fade out as the camera zooms out past the threshold, except the hovered, open and
 * focused notes. The layer ignores the pointer so wheel zoom and drag reach the canvas.
 */
export function GraphLabels({ renderer, nodes, typeEntryMap, selectedNotePath, emphasis, textFadeThreshold }: GraphLabelsProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const writtenRef = useRef(new WeakMap<LabelChip, ChipState | null>())
  const sidesRef = useRef(new Map<string, LabelSide>())
  const ranked = useMemo(() => rankLabels(nodes), [nodes])
  const forced = useMemo(() => forcedLabels(emphasis, selectedNotePath), [emphasis, selectedNotePath])
  const forcedKey = ranked.length > LABEL_DOM_LIMIT ? forced.join('\n') : ''
  // Past the DOM limit the chip list follows the forced notes; below it, hovering never re-renders the chips.
  const labelled = useMemo(() => labelledNodes(ranked, new Set(forcedKey.split('\n'))), [ranked, forcedKey])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const chips = chipMap(container)
    const source: PlaceSource = { renderer, chips, written: writtenRef.current, order: labelOrder(ranked, forced), forced: new Set(forced), threshold: textFadeThreshold, sides: sidesRef.current }
    markEmphasis(chips, emphasis)
    const place = () => placeFrame(source)
    place()
    renderer.on('afterRender', place)
    return () => {
      renderer.off('afterRender', place)
    }
  }, [emphasis, forced, labelled, ranked, renderer, textFadeThreshold])

  // Hover and focus changes re-place the chips without re-rendering a thousand of them.
  const chips = useMemo(() => labelled.map(({ id, entry }) => (
    <div key={id} className="graph-label" data-node={id} data-selected={id === selectedNotePath ? 'true' : undefined} data-testid="graph-label">
      <span className="graph-label__chip">
        <LabelIcon icon={entry.icon} glyph={typeGlyph(entry, typeEntryMap)} />
        <span className="graph-label__title">{entry.title}</span>
      </span>
    </div>
  )), [labelled, selectedNotePath, typeEntryMap])

  return (
    <div ref={containerRef} className="graph-labels" aria-hidden="true" data-testid="graph-labels">
      {chips}
    </div>
  )
}
