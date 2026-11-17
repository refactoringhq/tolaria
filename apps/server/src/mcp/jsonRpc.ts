/**
 * JSON-RPC 2.0 for the MCP endpoint: one message per request body, no batches. Nothing here
 * knows about the vault.
 */

export const PARSE_ERROR = -32700
export const INVALID_REQUEST = -32600
export const METHOD_NOT_FOUND = -32601
export const INVALID_PARAMS = -32602

/** MCP revisions this server speaks, newest first. */
export const MCP_PROTOCOL_VERSIONS: readonly string[] = ['2025-06-18', '2025-03-26']

export type RpcId = string | number
export type RpcParams = Record<string, unknown>

/** A message the server answers, or one it only acknowledges. */
export type Incoming =
  | { kind: 'request'; id: RpcId; method: string; params: RpcParams }
  /** A notification or a response to the server: answered with 202 and no body. */
  | { kind: 'acknowledged' }

export interface RpcReply {
  jsonrpc: '2.0'
  id: RpcId | null
  result?: unknown
  error?: { code: number; message: string }
}

/** A failure that becomes a JSON-RPC error reply. */
export class RpcError extends Error {
  readonly code: number
  readonly id: RpcId | null

  constructor(code: number, message: string, id: RpcId | null = null) {
    super(message)
    this.name = 'RpcError'
    this.code = code
    this.id = id
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value instanceof Object && !Array.isArray(value)
}

function isId(value: unknown): value is RpcId {
  return typeof value === 'string' || Number.isInteger(value)
}

function parseJson(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(Buffer.from(bytes).toString('utf8'))
  } catch {
    throw new RpcError(PARSE_ERROR, 'the body is not valid JSON')
  }
}

function envelope(parsed: unknown): Record<string, unknown> {
  if (Array.isArray(parsed)) throw new RpcError(INVALID_REQUEST, 'batches are not supported: send one message per request')
  if (isRecord(parsed) && parsed.jsonrpc === '2.0') return parsed
  const id = isRecord(parsed) && isId(parsed.id) ? parsed.id : null
  throw new RpcError(INVALID_REQUEST, 'not a JSON-RPC 2.0 message', id)
}

function params(message: Record<string, unknown>, id: RpcId): RpcParams {
  if (message.params === undefined) return {}
  if (isRecord(message.params)) return message.params
  throw new RpcError(INVALID_REQUEST, 'params must be an object', id)
}

/** A message without a method is only fine as a client's response to the server. */
function response(message: Record<string, unknown>, id: RpcId | null): Incoming {
  if (id !== null && ('result' in message || 'error' in message)) return { kind: 'acknowledged' }
  throw new RpcError(INVALID_REQUEST, 'a message needs a method', id)
}

/** Reads one JSON-RPC message; throws `RpcError` for anything that is not one. */
export function parseMessage(bytes: Uint8Array): Incoming {
  const message = envelope(parseJson(bytes))
  const id = isId(message.id) ? message.id : null
  if (typeof message.method !== 'string') return response(message, id)
  if (message.id === undefined) return { kind: 'acknowledged' }
  if (id === null) throw new RpcError(INVALID_REQUEST, 'id must be a string or an integer')
  return { kind: 'request', id, method: message.method, params: params(message, id) }
}

/** The version the client asked for when the server knows it, otherwise the newest it knows. */
export function negotiateVersion(requested: unknown): string {
  const known = MCP_PROTOCOL_VERSIONS.find((version) => version === requested)
  return known ?? MCP_PROTOCOL_VERSIONS[0]
}

export function isKnownVersion(version: string): boolean {
  return MCP_PROTOCOL_VERSIONS.includes(version)
}

export function resultReply(id: RpcId, result: unknown): RpcReply {
  return { jsonrpc: '2.0', id, result }
}

export function errorReply(error: RpcError): RpcReply {
  return { jsonrpc: '2.0', id: error.id, error: { code: error.code, message: error.message } }
}
