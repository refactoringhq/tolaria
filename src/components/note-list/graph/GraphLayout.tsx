import './GraphLayout.css'
import { lazy, Suspense, useMemo } from 'react'
import type { GraphSettings } from '../../../collections/collectionTypes'
import type { CollectionLayoutSharedProps, GraphLayoutBindings } from '../../../collections/layoutRegistry'
import { GraphEmptyState } from './GraphEmptyState'
import { hasNoConnections, visibleGraph } from './graphModel'

// sigma and graphology load with the first graph, so the other layouts never pay for them.
const GraphCanvas = lazy(() => import('./GraphCanvas'))

export type GraphLayoutProps = CollectionLayoutSharedProps & { graph: GraphLayoutBindings }

/** Settings rebuilt with the same values keep their identity, so the canvas doesn't re-sync on every render. */
function useStableSettings(settings: GraphSettings): GraphSettings {
  const key = JSON.stringify(settings)
  return useMemo(() => JSON.parse(key) as GraphSettings, [key])
}

export function GraphLayout({ locale, typeEntryMap, selectedNotePath, onOpen, graph }: GraphLayoutProps) {
  const settings = useStableSettings(graph.settings)
  const { data } = graph
  const visible = useMemo(() => (data ? visibleGraph(data, settings) : null), [data, settings])
  if (!data || !visible) return null
  if (hasNoConnections(data)) return <GraphEmptyState graph={graph} locale={locale} filtered={false} />
  if (visible.nodes.length === 0) return <GraphEmptyState graph={graph} locale={locale} filtered />
  return (
    <div
      className="graph-layout"
      data-testid="graph-layout"
      data-node-count={visible.nodes.length}
      data-relationship-edge-count={visible.edges.filter((edge) => edge.kind === 'relationship').length}
      data-wikilink-edge-count={visible.edges.filter((edge) => edge.kind === 'wikilink').length}
    >
      <Suspense fallback={null}>
        <GraphCanvas
          visible={visible}
          settings={settings}
          typeEntryMap={typeEntryMap}
          selectedNotePath={selectedNotePath ?? null}
          panelOpen={graph.panelOpen}
          locale={locale}
          onOpen={onOpen}
          onBackgroundClick={graph.onBackgroundClick}
        />
      </Suspense>
    </div>
  )
}
