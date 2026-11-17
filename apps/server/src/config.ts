import { isIP } from 'node:net'
import { join } from 'node:path'
import { COLLAB_MAX_MESSAGE_BYTES } from '../../../packages/protocol/src/index.ts'
import { type ConnectionLimits, DEFAULT_CONNECTION_LIMITS } from './collab/connectionLimits.ts'
import { DEFAULT_FLUSH_POLICY, type FlushPolicy } from './collab/flush.ts'
import { dataDirOf, envSetting, tokensFileOf, vaultDirOf } from './dataPaths.ts'
import { DEFAULT_RATE_LIMIT, type RateLimit } from './rateLimit.ts'
import type { R2Config } from './store.ts'

export type BlobStoreType = 'local' | 'r2'

export interface ServerConfig {
  token: string
  host: string
  port: number
  /** Git URL of the vault's remote. Optional once the working clone exists. */
  remoteUrl?: string
  branch?: string
  /** How often the vault pulls from its remote unasked, in ms: 0 never, unset the vault default. */
  fetchIntervalMs?: number
  /** Directory of the server's working clone of the vault. */
  vaultDir: string
  /** Directory of server state that is not in git (doc index, later Y.Doc snapshots). */
  stateDir: string
  /** The agent token file (`TOLARIA_SERVER_TOKENS_FILE`); never inside `vaultDir`. */
  tokensFile: string
  maxBodyBytes: number
  /** Requests per account (the token), over every route but `/healthz`. */
  rateLimit: RateLimit
  /** Null when the collaboration channel is switched off. */
  collab: { policy: FlushPolicy; lingerMs: number; limits: ConnectionLimits; maxMessageBytes?: number } | null
  /** Blob store configuration */
  blobStore: { type: 'local'; stateDir: string } | { type: 'r2'; config: R2Config }
  /**
   * Where index snapshots are kept for a server on a fresh disk (`TOLARIA_INDEX_SNAPSHOTS=r2`),
   * under `prefix` (one per vault). Null: indexes are only kept in the blob store.
   */
  indexSnapshots: { r2: R2Config; prefix: string } | null
  /** Whether `POST /mcp` is served; `TOLARIA_MCP=0` switches it off. */
  mcp: boolean
  /** Whether the R2 endpoints may be private or loopback addresses (development only); see `storeEndpoint.ts`. */
  allowPrivateR2Endpoint: boolean
}

type Env = Record<string, string | undefined>

const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_PORT = 8787
const DEFAULT_MAX_BODY_BYTES = 25 * 1024 * 1024
const MIN_TOKEN_LENGTH = 16
const DEFAULT_LINGER_MS = 30_000
const MAX_DELAY_MS = 24 * 60 * 60 * 1000
const MAX_RATE = 1_000_000
const MAX_CONNECTIONS = 100_000
const LOOPBACK_NAMES = new Set(['localhost', '::1'])

const setting = envSetting

function positiveInteger(env: Env, name: string, fallback: number, max: number): number {
  const raw = setting(env, name)
  if (raw === undefined) return fallback
  const value = Number(raw)
  // Clamping changes anything outside 1..max, so only an in-range integer survives both checks.
  if (Number.isInteger(value) && Math.min(Math.max(value, 1), max) === value) return value
  throw new Error(`${name} must be an integer between 1 and ${max}`)
}

function requiredToken(env: Env): string {
  const token = setting(env, 'TOLARIA_SERVER_TOKEN')
  if (!token) throw new Error('TOLARIA_SERVER_TOKEN is required: the server does not start without a bearer token')
  if (token.length < MIN_TOKEN_LENGTH) {
    throw new Error(`TOLARIA_SERVER_TOKEN must be at least ${MIN_TOKEN_LENGTH} characters`)
  }
  return token
}

export function isLoopbackHost(host: string): boolean {
  if (LOOPBACK_NAMES.has(host.toLowerCase())) return true
  return isIP(host) === 4 && host.startsWith('127.')
}

/** The service speaks plain HTTP, so leaving loopback takes an explicit opt-in. */
function bindHost(env: Env): string {
  const host = setting(env, 'TOLARIA_SERVER_HOST') ?? DEFAULT_HOST
  if (isLoopbackHost(host) || setting(env, 'TOLARIA_SERVER_ALLOW_NON_LOOPBACK') === '1') return host
  throw new Error(
    `refusing to bind ${host}: set TOLARIA_SERVER_ALLOW_NON_LOOPBACK=1 only behind a TLS-terminating proxy`,
  )
}

function rateLimitSettings(env: Env): RateLimit {
  const { perSecond, burst } = DEFAULT_RATE_LIMIT
  return {
    perSecond: positiveInteger(env, 'TOLARIA_RATE_LIMIT_PER_SECOND', perSecond, MAX_RATE),
    burst: positiveInteger(env, 'TOLARIA_RATE_LIMIT_BURST', burst, MAX_RATE),
  }
}

function connectionLimits(env: Env): ConnectionLimits {
  const { perAccount, perDoc, idleTimeoutMs } = DEFAULT_CONNECTION_LIMITS
  return {
    perAccount: positiveInteger(env, 'TOLARIA_COLLAB_MAX_CONNECTIONS', perAccount, MAX_CONNECTIONS),
    perDoc: positiveInteger(env, 'TOLARIA_COLLAB_MAX_CONNECTIONS_PER_DOC', perDoc, MAX_CONNECTIONS),
    idleTimeoutMs: positiveInteger(env, 'TOLARIA_COLLAB_SOCKET_IDLE_TIMEOUT_MS', idleTimeoutMs, MAX_DELAY_MS),
  }
}

/** Unset leaves the websocket message limit at the body limit. */
function maxMessageBytes(env: Env): { maxMessageBytes?: number } {
  if (setting(env, 'TOLARIA_COLLAB_MAX_MESSAGE_BYTES') === undefined) return {}
  return { maxMessageBytes: positiveInteger(env, 'TOLARIA_COLLAB_MAX_MESSAGE_BYTES', 1, COLLAB_MAX_MESSAGE_BYTES) }
}

/** `TOLARIA_VAULT_FETCH_INTERVAL_MS=0` leaves pulls to writes and syncs. */
function fetchIntervalMs(env: Env): number | undefined {
  const name = 'TOLARIA_VAULT_FETCH_INTERVAL_MS'
  if (setting(env, name) === '0') return 0
  return setting(env, name) === undefined ? undefined : positiveInteger(env, name, 0, MAX_DELAY_MS)
}

function collabSettings(env: Env): ServerConfig['collab'] {
  if (setting(env, 'TOLARIA_COLLAB') === '0') return null
  const { idleMs, maxWaitMs } = DEFAULT_FLUSH_POLICY
  return {
    policy: {
      idleMs: positiveInteger(env, 'TOLARIA_COLLAB_IDLE_MS', idleMs, MAX_DELAY_MS),
      maxWaitMs: positiveInteger(env, 'TOLARIA_COLLAB_MAX_WAIT_MS', maxWaitMs, MAX_DELAY_MS),
    },
    lingerMs: positiveInteger(env, 'TOLARIA_COLLAB_LINGER_MS', DEFAULT_LINGER_MS, MAX_DELAY_MS),
    limits: connectionLimits(env),
    ...maxMessageBytes(env),
  }
}

function required(env: Env, name: string, purpose: string): string {
  const value = setting(env, name)
  if (!value) throw new Error(`${name} is required when ${purpose}`)
  return value
}

function endpointSetting(env: Env, purpose: string): string {
  const endpoint = required(env, 'TOLARIA_R2_ENDPOINT', purpose)
  if (!URL.canParse(endpoint)) throw new Error('TOLARIA_R2_ENDPOINT must be a valid URL')
  if (!['http:', 'https:'].includes(new URL(endpoint).protocol)) {
    throw new Error('TOLARIA_R2_ENDPOINT must be an HTTP or HTTPS URL')
  }
  return endpoint
}

function r2Settings(env: Env, purpose: string): R2Config {
  const bucket = required(env, 'TOLARIA_R2_BUCKET', purpose)
  const endpoint = endpointSetting(env, purpose)
  const region = required(env, 'TOLARIA_R2_REGION', purpose)
  const accessKeyId = required(env, 'TOLARIA_R2_ACCESS_KEY_ID', purpose)
  const secretAccessKey = required(env, 'TOLARIA_R2_SECRET_ACCESS_KEY', purpose)
  return { bucket, endpoint, region, accessKeyId, secretAccessKey }
}

/** A local MinIO or podman S3 lives on a private address, which only a development server may reach (TOL-207). */
function allowPrivateR2Endpoint(env: Env): boolean {
  if (setting(env, 'TOLARIA_R2_ALLOW_PRIVATE_ENDPOINT') !== '1') return false
  if (setting(env, 'NODE_ENV') === 'development') return true
  throw new Error('TOLARIA_R2_ALLOW_PRIVATE_ENDPOINT is for development only: it also needs NODE_ENV=development')
}

function blobStoreSettings(env: Env, stateDir: string): ServerConfig['blobStore'] {
  const blobStoreType = setting(env, 'TOLARIA_BLOBSTORE') ?? 'local'
  
  if (blobStoreType === 'local') {
    return { type: 'local', stateDir }
  }
  
  if (blobStoreType === 'r2') {
    return { type: 'r2', config: r2Settings(env, 'TOLARIA_BLOBSTORE=r2') }
  }
  
  throw new Error(`invalid TOLARIA_BLOBSTORE value: ${blobStoreType} (must be 'local' or 'r2')`)
}

const SNAPSHOT_PREFIX = /^[A-Za-z0-9_-][A-Za-z0-9._-]*(\/[A-Za-z0-9_-][A-Za-z0-9._-]*)*$/

function indexSnapshotSettings(env: Env): ServerConfig['indexSnapshots'] {
  const type = setting(env, 'TOLARIA_INDEX_SNAPSHOTS')
  if (type === undefined) return null
  if (type !== 'r2') throw new Error(`invalid TOLARIA_INDEX_SNAPSHOTS value: ${type} (must be 'r2' or unset)`)
  const prefix = setting(env, 'TOLARIA_INDEX_SNAPSHOT_PREFIX')
  if (!prefix) throw new Error('TOLARIA_INDEX_SNAPSHOT_PREFIX is required when TOLARIA_INDEX_SNAPSHOTS=r2')
  if (!SNAPSHOT_PREFIX.test(prefix)) {
    throw new Error('TOLARIA_INDEX_SNAPSHOT_PREFIX must be /-separated letters, digits, ".", "_" and "-"')
  }
  return { r2: r2Settings(env, 'TOLARIA_INDEX_SNAPSHOTS=r2'), prefix }
}

/** Reads the configuration from the environment. Throws with a message fit for the operator. */
export function loadConfig(env: Env): ServerConfig {
  const token = requiredToken(env)
  const dataDir = dataDirOf(env)
  const stateDir = join(dataDir, 'state')
  return {
    token,
    host: bindHost(env),
    port: positiveInteger(env, 'TOLARIA_SERVER_PORT', DEFAULT_PORT, 65_535),
    remoteUrl: setting(env, 'TOLARIA_VAULT_REMOTE_URL'),
    branch: setting(env, 'TOLARIA_VAULT_BRANCH'),
    fetchIntervalMs: fetchIntervalMs(env),
    vaultDir: vaultDirOf(dataDir),
    stateDir,
    tokensFile: tokensFileOf(env, dataDir),
    maxBodyBytes: positiveInteger(env, 'TOLARIA_SERVER_MAX_BODY_BYTES', DEFAULT_MAX_BODY_BYTES, 2 ** 31),
    rateLimit: rateLimitSettings(env),
    collab: collabSettings(env),
    mcp: setting(env, 'TOLARIA_MCP') !== '0',
    blobStore: blobStoreSettings(env, stateDir),
    indexSnapshots: indexSnapshotSettings(env),
    allowPrivateR2Endpoint: allowPrivateR2Endpoint(env),
  }
}
