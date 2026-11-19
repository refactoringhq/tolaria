import type Graph from 'graphology'
import { applyPositions, LAYOUT_BATCH, runLayoutBatch, snapshotGraph } from './graphLayoutSteps'

interface LayoutResponse {
  requestId: number
  ids: string[]
  positions: number[]
  finished: boolean
}

let nextRequestId = 1

function createLayoutWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null
  return new Worker(new URL('./graphLayout.worker.ts', import.meta.url), { type: 'module' })
}

/** Without workers (tests, very old webviews) the layout runs in small main-thread slices. */
function settleWithoutWorker(graph: Graph, iterations: number): () => void {
  let done = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  const step = () => {
    runLayoutBatch(graph, LAYOUT_BATCH)
    done += LAYOUT_BATCH
    timer = done < iterations ? setTimeout(step, 16) : null
  }
  timer = setTimeout(step, 0)
  return () => {
    if (timer) clearTimeout(timer)
  }
}

/**
 * Settles the graph in a worker, streaming positions back after every batch; the graph stops moving once
 * the iterations are spent. Returns a cancel function; a newer layout supersedes an older one.
 */
export function settleGraph(graph: Graph, iterations: number): () => void {
  const worker = createLayoutWorker()
  if (!worker) return settleWithoutWorker(graph, iterations)
  const requestId = nextRequestId
  nextRequestId += 1
  worker.onmessage = (event: MessageEvent<LayoutResponse>) => {
    if (event.data.requestId !== requestId) return
    applyPositions(graph, event.data.ids, event.data.positions)
    if (event.data.finished) worker.terminate()
  }
  worker.onerror = () => worker.terminate()
  worker.postMessage({ requestId, snapshot: snapshotGraph(graph, iterations) })
  return () => worker.terminate()
}
