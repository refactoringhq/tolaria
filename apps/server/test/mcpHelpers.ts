import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'
import { ChangeEmitter } from '../src/changeEmitter.ts'
import { closeVaultServer, createVaultServer, type ServerOptions } from '../src/server.ts'
import { LocalDiskStore } from '../src/store.ts'
import type { Vault } from '../src/vault.ts'
import { TOKEN } from './accessHelpers.ts'
import type { Fixture } from './helpers.ts'

export interface ToolResult {
  content: { type: string; text: string }[]
  isError?: boolean
}

export interface RpcReply {
  jsonrpc: string
  id: number | string | null
  result?: unknown
  error?: { code: number; message: string }
}

type Extra = Pick<ServerOptions, 'collab' | 'mcp' | 'rateLimit'>

/** A vault server on loopback for MCP tests, with the file API and, unless switched off, the collaboration channel. */
export class McpServer {
  readonly fixture: Fixture
  readonly vault: Vault
  private server: Server | undefined
  private base = ''
  private nextId = 1

  constructor(fixture: Fixture, vault: Vault) {
    this.fixture = fixture
    this.vault = vault
  }

  async start(extra: Extra = {}): Promise<void> {
    this.server = await createVaultServer({
      vault: this.vault,
      store: new LocalDiskStore(join(this.fixture.root, 'server', 'state')),
      token: TOKEN,
      maxBodyBytes: 1024 * 1024,
      collab: false,
      changes: new ChangeEmitter(),
      ...extra,
    })
    const server = this.server
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    this.base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  }

  async stop(): Promise<void> {
    if (this.server) await closeVaultServer(this.server)
  }

  url(path: string): URL {
    return new URL(path, this.base)
  }

  /** A raw request to the MCP route; the token unless `credential` says otherwise. */
  post(body: string, headers: Record<string, string> = {}, credential: string | null = TOKEN): Promise<Response> {
    const auth: Record<string, string> = credential === null ? {} : { authorization: `Bearer ${credential}` }
    return fetch(this.url('/mcp'), {
      method: 'POST',
      body,
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...auth, ...headers },
    })
  }

  async request(method: string, params?: object, credential: string = TOKEN): Promise<RpcReply> {
    const response = await this.post(JSON.stringify({ jsonrpc: '2.0', id: this.nextId++, method, params }), {}, credential)
    return (await response.json()) as RpcReply
  }

  async tool(name: string, args: object = {}, credential: string = TOKEN): Promise<ToolResult> {
    const reply = await this.request('tools/call', { name, arguments: args }, credential)
    if (reply.error) throw new Error(`tools/call failed: ${reply.error.message}`)
    return reply.result as ToolResult
  }

  /** The tool's JSON answer; fails when the call reported an error. */
  async json<T>(name: string, args: object = {}, credential: string = TOKEN): Promise<T> {
    const result = await this.tool(name, args, credential)
    if (result.isError) throw new Error(`${name} failed: ${result.content[0].text}`)
    return JSON.parse(result.content[0].text) as T
  }

  /** Pulls what the desktop pushed, as the background fetch would. */
  async sync(): Promise<void> {
    await fetch(this.url('/v1/sync'), { method: 'POST', headers: { authorization: `Bearer ${TOKEN}` } })
  }
}
