import type { GitHttpRequest, HttpClient } from 'isomorphic-git'

type FetchReply = Pick<Response, 'body' | 'arrayBuffer' | 'headers' | 'url' | 'status' | 'statusText'>
type GitFetchOptions = Pick<RequestInit, 'method' | 'headers' | 'redirect' | 'credentials'> & { body?: Uint8Array<ArrayBuffer>; signal?: AbortSignal }
export type GitFetch = (url: string, options?: GitFetchOptions) => Promise<FetchReply>

export function createGitFetchClient(request: GitFetch): HttpClient {
  return { request: (options) => sendRequest(request, options) }
}

async function sendRequest(request: GitFetch, options: GitHttpRequest) {
  const controller = new AbortController()
  const abort = () => controller.abort()
  const timeout = setTimeout(abort, 120_000)
  const finish = () => { clearTimeout(timeout); options.signal?.removeEventListener('abort', abort) }
  options.signal?.addEventListener('abort', abort, { once: true })
  if (options.signal?.aborted) abort()
  try {
    const response = await request(options.url, {
      method: options.method ?? 'GET',
      headers: options.headers,
      body: await collectUpload(options.body),
      signal: controller.signal,
      redirect: 'error',
      credentials: 'omit',
    })
    const body = await responseBody(response, finish)
    return {
      url: response.url,
      statusCode: response.status,
      statusMessage: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body,
    }
  } catch (error) {
    finish()
    throw error
  }
}

async function collectUpload(body: GitHttpRequest['body']) {
  if (!body) return undefined
  const chunks: Uint8Array[] = []
  let size = 0
  for await (const chunk of body) { chunks.push(chunk); size += chunk.length }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  return bytes
}

async function responseBody(response: FetchReply, finish: () => void) {
  if (response.status >= 300 || !response.body) {
    try { return singleChunk(new Uint8Array(await response.arrayBuffer())) }
    finally { finish() }
  }
  return streamResponse(response.body, finish)
}

async function* singleChunk(bytes: Uint8Array) { yield bytes }

async function* streamResponse(body: ReadableStream<Uint8Array>, finish: () => void) {
  const reader = body.getReader()
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) return
      yield chunk.value
    }
  } finally {
    reader.releaseLock()
    finish()
  }
}
