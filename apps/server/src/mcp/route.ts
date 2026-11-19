import type { IncomingHttpHeaders } from 'node:http'
import { PROTOCOL_VERSION } from '../../../../packages/protocol/src/index.ts'
import { singleHeader, type Reply } from '../httpIo.ts'
import type { ApiRequest, Services } from '../routes.ts'
import {
  errorReply,
  type Incoming,
  INVALID_REQUEST,
  isKnownVersion,
  METHOD_NOT_FOUND,
  negotiateVersion,
  parseMessage,
  resultReply,
  RpcError,
  type RpcParams,
} from './jsonRpc.ts'
import type { ToolContext } from './results.ts'
import { TOOL_DEFINITIONS } from './toolDefinitions.ts'
import { callTool } from './tools.ts'

/**
 * `POST /mcp`: MCP Streamable HTTP in its stateless form. Each body is one JSON-RPC message,
 * answered with one JSON body; there is no session and no server-sent stream. Auth, rate limit
 * and body size were checked on the way in, like for every `/v1` route.
 */
export const MCP_PATH = '/mcp'

const VERSION_HEADER = 'mcp-protocol-version'

type Method = (params: RpcParams, context: ToolContext) => Promise<unknown>

const METHODS = new Map<string, Method>([
  [
    'initialize',
    async (params) => ({
      protocolVersion: negotiateVersion(params.protocolVersion),
      capabilities: { tools: {} },
      serverInfo: { name: 'tolaria-remote', version: PROTOCOL_VERSION },
    }),
  ],
  ['ping', async () => ({})],
  ['tools/list', async () => ({ tools: TOOL_DEFINITIONS })],
  ['tools/call', callTool],
])

function badRequest(error: RpcError): Reply {
  return { status: 400, body: errorReply(error) }
}

function unknownVersion(headers: IncomingHttpHeaders): RpcError | null {
  const version = singleHeader(headers, VERSION_HEADER)
  if (version === undefined || isKnownVersion(version)) return null
  return new RpcError(INVALID_REQUEST, `this server does not speak MCP ${version}`)
}

function read(bytes: Buffer): Incoming | RpcError {
  try {
    return parseMessage(bytes)
  } catch (error) {
    if (error instanceof RpcError) return error
    throw error
  }
}

async function answer(request: Extract<Incoming, { kind: 'request' }>, context: ToolContext): Promise<Reply> {
  const method = METHODS.get(request.method)
  try {
    if (!method) throw new RpcError(METHOD_NOT_FOUND, `method not found: ${request.method}`)
    return { status: 200, body: resultReply(request.id, await method(request.params, context)) }
  } catch (error) {
    if (!(error instanceof RpcError)) throw error
    return { status: 200, body: errorReply(new RpcError(error.code, error.message, request.id)) }
  }
}

export async function mcpEndpoint(request: ApiRequest, services: Services): Promise<Reply> {
  const refused = unknownVersion(request.headers)
  if (refused) return badRequest(refused)
  const message = read(await request.body())
  if (message instanceof RpcError) return badRequest(message)
  if (message.kind === 'acknowledged') return { status: 202 }
  return answer(message, { services, access: request.access })
}
