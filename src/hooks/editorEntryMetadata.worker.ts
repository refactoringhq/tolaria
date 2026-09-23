/// <reference lib="webworker" />

import {
  deriveEditorEntryContentMetadata,
  type EditorEntryMetadataRequest,
} from './editorEntryMetadata'

interface MetadataWorkerRequest {
  request: EditorEntryMetadataRequest
  requestId: number
}

const workerScope = self as DedicatedWorkerGlobalScope

workerScope.onmessage = (event: MessageEvent<MetadataWorkerRequest>) => {
  const { request, requestId } = event.data
  workerScope.postMessage({
    metadata: deriveEditorEntryContentMetadata(request),
    requestId,
  })
}
