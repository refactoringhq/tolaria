import {
  deriveEditorEntryContentMetadata,
  type EditorEntryContentMetadata,
  type EditorEntryMetadataRequest,
} from './editorEntryMetadata'

interface WorkerRequest {
  request: EditorEntryMetadataRequest
  requestId: number
}

interface WorkerResponse {
  metadata: Partial<EditorEntryContentMetadata>
  requestId: number
}

interface PendingRequest {
  onError: (reason: unknown) => void
  onResult: (metadata: Partial<EditorEntryContentMetadata>) => void
}

let metadataWorker: Worker | null = null
let nextRequestId = 1
const pendingRequests = new Map<number, PendingRequest>()

function rejectPendingRequests(reason: unknown): void {
  pendingRequests.forEach(({ onError }) => {
    onError(reason)
  })
  pendingRequests.clear()
}

function handleWorkerMessage(event: MessageEvent<WorkerResponse>): void {
  const pending = pendingRequests.get(event.data.requestId)
  if (!pending) return

  pendingRequests.delete(event.data.requestId)
  pending.onResult(event.data.metadata)
}

function handleWorkerError(event: ErrorEvent): void {
  rejectPendingRequests(event.error ?? event.message)
  metadataWorker?.terminate()
  metadataWorker = null
}

function activeMetadataWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null
  if (metadataWorker) return metadataWorker

  metadataWorker = new Worker(new URL('./editorEntryMetadata.worker.ts', import.meta.url), { type: 'module' })
  metadataWorker.onmessage = handleWorkerMessage
  metadataWorker.onerror = handleWorkerError
  return metadataWorker
}

export function requestEditorEntryMetadata(
  request: EditorEntryMetadataRequest,
  onResult: PendingRequest['onResult'],
  onError: PendingRequest['onError'],
): () => void {
  const worker = activeMetadataWorker()
  if (!worker) {
    onResult(deriveEditorEntryContentMetadata(request))
    return () => {}
  }

  const requestId = nextRequestId
  nextRequestId += 1
  pendingRequests.set(requestId, { onError, onResult })
  const workerRequest: WorkerRequest = { request, requestId }
  worker.postMessage(workerRequest)
  return () => pendingRequests.delete(requestId)
}
