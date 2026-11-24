import { createServer } from 'node:http'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import { isSupportedProtocolVersion, PROTOCOL_HEADER } from '../../../packages/protocol/src/index.ts'
import type { ChangeEmitter } from './changeEmitter.ts'
import { DEFAULT_FLUSH_POLICY, type FlushPolicy } from './collab/flush.ts'
import { ConnectionCounter, type ConnectionLimits, DEFAULT_CONNECTION_LIMITS } from './collab/connectionLimits.ts'
import { CollabHub } from './collab/hub.ts'
import { TicketBook } from './collab/tickets.ts'
import { attachCollab } from './collab/upgrade.ts'
import { Revocations } from './accessRevocations.ts'
import { type Credential, Credentials } from './credentials.ts'
import { DocIndex } from './docIndex.ts'
import { VaultError } from './errors.ts'
import { errorReply, type Reply, readBody, send, singleHeader } from './httpIo.ts'
import { isNote, type VaultPath } from './paths.ts'
import { ANONYMOUS, DEFAULT_RATE_LIMIT, type RateLimit, RateLimited, RateLimiter } from './rateLimit.ts'
import { route, type Services } from './routes.ts'
import type { BlobStore } from './store.ts'
import type { Vault } from './vault.ts'
import { VaultIndex } from './vaultIndex.ts'

export interface ServerOptions {
  vault: Vault
  store: BlobStore
  token: string
  maxBodyBytes: number
  log?: (message: string) => void
  /** Settings of the collaboration channel; `false` leaves it reserved and unserved. */
  collab?: CollabOptions | false
  /** SSE change emitter for the change feed. */
  changes: ChangeEmitter
  /** Called when the server is ready to serve requests. */
  onReady?: () => void
  /** Requests per account on every route but `/healthz` and websocket upgrades; `DEFAULT_RATE_LIMIT` by default. */
  rateLimit?: RateLimit
}

export interface CollabOptions {
  policy?: FlushPolicy
  /** How long a document without clients stays open. */
  lingerMs?: number
  /** Websocket limits; each one left out is the default in `DEFAULT_CONNECTION_LIMITS`. */
  limits?: Partial<ConnectionLimits>
  /** Largest websocket message. Defaults to `maxBodyBytes`; never above the protocol's 16 MiB. */
  maxMessageBytes?: number
}

/** What every request is answered with. */
interface Handling {
  services: Services
  options: ServerOptions
  server: Server
  limiter: RateLimiter
  credentials: Credentials
}

const DEFAULT_LINGER_MS = 30_000
/** What to do before the HTTP server of a vault stops, by server. */
const SHUTDOWN = new WeakMap<Server, () => Promise<void>>()
/** Whether the server is ready to serve requests (vault and index initialized). */
const READY = new WeakMap<Server, boolean>()

const HEALTH_PATH = '/healthz'

function checkAccess(request: IncomingMessage, credential: Credential | null): Credential {
  if (!credential) throw new VaultError(401, 'unauthorized', 'a valid bearer token or access ticket is required')
  const version = singleHeader(request.headers, PROTOCOL_HEADER)
  if (version !== undefined && !isSupportedProtocolVersion(version)) {
    throw new VaultError(400, 'unsupported_protocol_version', `this server does not speak protocol ${version}`)
  }
  return credential
}

function health(server: Server): Reply {
  return READY.get(server)
    ? { status: 200, body: { status: 'ok' } }
    : { status: 503, body: { status: 'not_ready', message: 'vault is initializing' } }
}

/** Charges the request to its account's bucket, before anything else is done for it. */
function checkRate(credential: Credential | null, limiter: RateLimiter): void {
  const wait = limiter.take(credential?.account ?? ANONYMOUS)
  if (wait > 0) throw new RateLimited(wait)
}

async function answer(request: IncomingMessage, response: ServerResponse, handling: Handling): Promise<Reply> {
  const { services, options, server, limiter, credentials } = handling
  // The base only gives relative request targets something to resolve against.
  const url = new URL(request.url ?? '/', 'http://vault.invalid')
  if (url.pathname === HEALTH_PATH) return health(server)
  const credential = credentials.of(singleHeader(request.headers, 'authorization'))
  checkRate(credential, limiter)
  const { access } = checkAccess(request, credential)
  return route(
    {
      method: request.method ?? 'GET',
      url,
      headers: request.headers,
      body: () => readBody(request, options.maxBodyBytes),
      response,
      access,
    },
    services,
  )
}

function failure(error: unknown, log: (message: string) => void): Reply {
  if (!(error instanceof VaultError)) log(`request failed: ${error instanceof Error ? error.stack : String(error)}`)
  const reply = errorReply(error)
  // The body may be unread, so the connection cannot be reused for another request.
  return { ...reply, headers: { connection: 'close', ...errorHeaders(error) } }
}

function errorHeaders(error: unknown): Record<string, string> {
  if (error instanceof RateLimited) return { 'retry-after': String(error.retryAfterSeconds) }
  if (error instanceof VaultError && error.status === 401) return { 'www-authenticate': 'Bearer' }
  return {}
}

/** Builds the HTTP server of one vault. The caller decides where it listens. */
export async function createVaultServer(options: ServerOptions): Promise<Server> {
  const { vault, changes } = options
  const log = options.log ?? (() => {})
  const docs = await DocIndex.open(options.store)
  const { files } = await vault.list()
  await docs.reconcile(files.map((file) => file.path as VaultPath).filter(isNote))
  vault.onChange((vaultChanges) => docs.apply(vaultChanges))
  const index = await VaultIndex.open(vault, options.store, log)
  vault.onChange((vaultChanges) => index.apply(vaultChanges))
  const { SearchIndex } = await import('./searchIndex.ts')
  const search = await SearchIndex.open(vault, options.store, log)
  vault.onChange((vaultChanges) => search.apply(vaultChanges))
  const tickets = options.collab === false ? undefined : new TicketBook()
  const revocations = new Revocations()
  const services: Services = { vault, docs, index, search, collab: tickets !== undefined, tickets, changes, revocations }
  const limiter = new RateLimiter(options.rateLimit ?? DEFAULT_RATE_LIMIT)
  const credentials = new Credentials(options.token, revocations)

  const server = createServer((request: IncomingMessage, response: ServerResponse) => {
    answer(request, response, { services, options, server, limiter, credentials })
      .catch((error: unknown) => failure(error, log))
      .then((reply: Reply & { sse?: boolean }) => {
        // SSE handlers write directly to response and set a marker
        if (!reply.sse) {
          send(response, reply)
        }
      })
  })
  READY.set(server, true)
  options.onReady?.()
  if (tickets) {
    serveCollab(server, { options, docs, tickets, changes, limiter, log, credentials, revocations })
  } else {
    // Set up shutdown handler even without collab
    setupShutdown(server, { vault, changes, log })
  }
  return server
}

interface CollabParts {
  options: ServerOptions
  docs: DocIndex
  tickets: TicketBook
  changes: ChangeEmitter
  limiter: RateLimiter
  credentials: Credentials
  revocations: Revocations
  log(message: string): void
}

function serveCollab(server: Server, parts: CollabParts): void {
  const { options, docs, tickets, changes, limiter, log, credentials, revocations } = parts
  const { vault, store } = options
  const settings = options.collab || {}
  const hub = new CollabHub({
    vault,
    docs,
    store,
    log,
    policy: settings.policy ?? DEFAULT_FLUSH_POLICY,
    lingerMs: settings.lingerMs ?? DEFAULT_LINGER_MS,
  })
  const limits = { ...DEFAULT_CONNECTION_LIMITS, ...settings.limits }
  const sockets = attachCollab(server, {
    hub,
    tickets,
    docs,
    credentials,
    revocations,
    log,
    maxMessageBytes: settings.maxMessageBytes ?? options.maxBodyBytes,
    limiter,
    connections: new ConnectionCounter(limits),
    idleTimeoutMs: limits.idleTimeoutMs,
  })
  setupShutdown(server, { vault, hub, sockets, changes, log })
}

function setupShutdown(
  server: Server,
  { vault, hub, sockets, changes, log }: { vault: Vault; hub?: CollabHub; sockets?: { close(): void }; changes: ChangeEmitter; log: (msg: string) => void }
): void {
  SHUTDOWN.set(server, async () => {
    if (hub && sockets) {
      log('shutdown: flushing open documents')
      await hub.close()
      sockets.close()
    }
    log('shutdown: closing change feed connections')
    changes.close()
    log('shutdown: committing and pushing')
    await vault.flushAndPush()
    log('shutdown: complete')
  })
}

/** Stops a vault server: open documents are written to their files first, then committed and pushed. */
export async function closeVaultServer(server: Server): Promise<void> {
  const shutdown = SHUTDOWN.get(server)
  if (shutdown) await shutdown()
  server.close()
  server.closeAllConnections()
}
