import { describe, expect, it } from 'vitest'
import {
  INVALID_REQUEST,
  isKnownVersion,
  negotiateVersion,
  PARSE_ERROR,
  parseMessage,
  RpcError,
} from '../src/mcp/jsonRpc.ts'

function parse(message: unknown): ReturnType<typeof parseMessage> {
  return parseMessage(Buffer.from(JSON.stringify(message)))
}

function refusal(message: unknown): RpcError {
  try {
    parse(message)
  } catch (error) {
    if (error instanceof RpcError) return error
    throw error
  }
  throw new Error('the message was accepted')
}

describe('JSON-RPC messages for MCP', () => {
  it('reads a request, with or without params', () => {
    expect(parse({ jsonrpc: '2.0', id: 'a', method: 'ping' })).toEqual({ kind: 'request', id: 'a', method: 'ping', params: {} })
    expect(parse({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'x' } })).toEqual({
      kind: 'request',
      id: 3,
      method: 'tools/call',
      params: { name: 'x' },
    })
  })

  it('acknowledges notifications and responses to the server', () => {
    expect(parse({ jsonrpc: '2.0', method: 'notifications/initialized' })).toEqual({ kind: 'acknowledged' })
    expect(parse({ jsonrpc: '2.0', id: 1, error: { code: 1, message: 'no' } })).toEqual({ kind: 'acknowledged' })
  })

  it('refuses what is not one well-formed message', () => {
    expect(() => parseMessage(Buffer.from('nope'))).toThrowError(expect.objectContaining({ code: PARSE_ERROR }))
    expect(refusal('ping')).toMatchObject({ code: INVALID_REQUEST, id: null })
    expect(refusal({ jsonrpc: '2.0', id: 4, method: 'ping', params: [1] })).toMatchObject({ code: INVALID_REQUEST, id: 4 })
    expect(refusal({ jsonrpc: '2.0', id: 1.5, method: 'ping' })).toMatchObject({ code: INVALID_REQUEST, id: null })
    expect(refusal({ jsonrpc: '2.0', id: null, method: 'ping' })).toMatchObject({ code: INVALID_REQUEST })
    expect(refusal({ jsonrpc: '2.0', id: 2 })).toMatchObject({ code: INVALID_REQUEST, id: 2 })
    expect(refusal({ jsonrpc: '2.0', result: {} })).toMatchObject({ code: INVALID_REQUEST, id: null })
  })

  it('picks the protocol version', () => {
    expect(negotiateVersion('2025-03-26')).toBe('2025-03-26')
    expect(negotiateVersion(undefined)).toBe('2025-06-18')
    expect(isKnownVersion('2025-06-18')).toBe(true)
    expect(isKnownVersion('2024-11-05')).toBe(false)
  })
})
