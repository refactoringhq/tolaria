import { graphFromSnapshot, type GraphLayoutSnapshot, LAYOUT_BATCH, readPositions, runLayoutBatch } from './graphLayoutSteps'

interface LayoutRequest {
  requestId: number
  snapshot: GraphLayoutSnapshot
}

/** One worker settles one layout request; the client terminates it when it is done or superseded. */
function settle({ requestId, snapshot }: LayoutRequest) {
  const graph = graphFromSnapshot(snapshot)
  let done = 0
  const step = () => {
    runLayoutBatch(graph, LAYOUT_BATCH)
    done += LAYOUT_BATCH
    const finished = done >= snapshot.iterations
    self.postMessage({ requestId, ids: snapshot.ids, positions: readPositions(graph, snapshot.ids), finished })
    if (!finished) setTimeout(step, 0)
  }
  step()
}

self.onmessage = (event: MessageEvent<LayoutRequest>) => settle(event.data)
