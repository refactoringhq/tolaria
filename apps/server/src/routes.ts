import type { IncomingHttpHeaders, ServerResponse } from 'node:http'
import {
  type AccessRevocationResult,
  COLLAB_CAPABILITIES,
  type CollabAccess,
  DOC_BLOCKS_FRAGMENT,
  DOC_FORMAT,
  DOC_FRONTMATTER_FIELD,
  DOC_ID_HEADER,
  DOC_META_MAP,
  type EntriesDeltaResponse,
  type EntriesResponse,
  FILE_CAPABILITIES,
  PROTOCOL_VERSION,
  ROUTES,
  type VaultResponse,
  type WriteResult,
} from '../../../packages/protocol/src/index.ts'
import { Access } from './access.ts'
import type { Revocations } from './accessRevocations.ts'
import { grantsFrom } from './accessTickets.ts'
import type { ChangeEmitter } from './changeEmitter.ts'
import type { TicketBook } from './collab/tickets.ts'
import type { DocIndex } from './docIndex.ts'
import { VaultError } from './errors.ts'
import { entityTag, errorReply, quoted, type Reply, singleHeader } from './httpIo.ts'
import { MCP_PATH, mcpEndpoint } from './mcp/route.ts'
import { invalidRequest, readFileAs, searchAs, writeFileAs } from './operations.ts'
import { isNote, type VaultPath, vaultPath } from './paths.ts'
import { type RemoteImageFetcher, remoteImageFetcher } from './remoteImage.ts'
import type { RenameOptions } from './renameTransaction.ts'
import type { SearchIndex } from './searchIndex.ts'
import type { TimedWriteResult, Timings, Vault, WritePrecondition } from './vault.ts'
import type { VaultIndex } from './vaultIndex.ts'

export interface Services {
  vault: Vault
  docs: DocIndex
  index: VaultIndex
  search: SearchIndex
  /** True once the collaboration channel is served, not only reserved. */
  collab: boolean
  /** Present when the collaboration channel is served. */
  tickets?: TicketBook
  /** SSE emitter for change feed. */
  changes: ChangeEmitter
  /** Revoked access tickets and the open connections admitted on access tickets. */
  revocations: Revocations
  /** True when `POST /mcp` is served (`TOLARIA_MCP`). */
  mcp: boolean
  /** Downloads images for `POST /v1/attachments/imports`; public hosts only unless a test swaps it. */
  remoteImages?: RemoteImageFetcher
}

export interface ApiRequest {
  method: string
  url: URL
  headers: IncomingHttpHeaders
  body(): Promise<Buffer>
  /** Present for SSE requests. */
  response?: ServerResponse
  /** What the request's credential allows: the owner for the bearer token. */
  access: Access
}

type Handler = (request: ApiRequest, services: Services, path: VaultPath) => Promise<Reply>
type Methods = Map<string, Handler>

const DEFAULT_SEARCH_LIMIT = 50
const WRITE_STATUS = new Map<string, number>([
  ['created', 201],
  ['recreated', 201],
  ['conflict', 409],
])

function withDocId<T extends { path: string }>(result: T, docs: DocIndex): T & { docId?: string } {
  const docId = docs.docId(result.path)
  return docId ? { ...result, docId } : result
}

async function describeVault({ access }: ApiRequest, { vault, collab }: Services): Promise<Reply> {
  const body: VaultResponse = {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: collab ? [...FILE_CAPABILITIES, ...COLLAB_CAPABILITIES] : [...FILE_CAPABILITIES],
    vault: await vault.info(),
    collab: {
      available: collab,
      path: ROUTES.collabDocs,
      docFormat: DOC_FORMAT,
      blocksFragment: DOC_BLOCKS_FRAGMENT,
      frontmatterField: DOC_FRONTMATTER_FIELD,
      metaMap: DOC_META_MAP,
    },
    access: access.describe(),
  }
  return { status: 200, body }
}

async function listFiles({ url, access }: ApiRequest, { vault, docs }: Services): Promise<Reply> {
  const { head, files } = await vault.list(url.searchParams.get('prefix') ?? '')
  return { status: 200, body: { head, files: docs.withDocIds(access.visible(files, (file) => file.path)) } }
}

async function readFile({ headers, access }: ApiRequest, { vault, docs }: Services, path: VaultPath): Promise<Reply> {
  const { bytes, etag } = await readFileAs(vault, access, path)
  const replyHeaders: Record<string, string> = {
    etag: quoted(etag),
    'content-type': isNote(path) ? 'text/markdown; charset=utf-8' : 'application/octet-stream',
  }
  const docId = docs.docId(path)
  if (docId) replyHeaders[DOC_ID_HEADER] = docId
  if (entityTag(singleHeader(headers, 'if-none-match')) === etag) return { status: 304, headers: replyHeaders }
  return { status: 200, headers: replyHeaders, body: bytes }
}

function writePrecondition(headers: IncomingHttpHeaders): WritePrecondition {
  const ifMatch = entityTag(singleHeader(headers, 'if-match'))
  if (ifMatch === '*') return { kind: 'any' }
  if (ifMatch) return { kind: 'match', etag: ifMatch }
  if (entityTag(singleHeader(headers, 'if-none-match')) === '*') return { kind: 'absent' }
  throw new VaultError(
    428,
    'precondition_required',
    'send If-Match with the etag you edited, If-None-Match: * to create, or If-Match: * to overwrite',
  )
}

function serverTiming({ pullMs, commitMs, pushMs }: Timings): string {
  const parts = [`pull;dur=${pullMs.toFixed(1)}`, `commit;dur=${commitMs.toFixed(1)}`, `push;dur=${pushMs.toFixed(1)}`]
  return parts.join(', ')
}

function writeReply({ timings, ...result }: TimedWriteResult, docs: DocIndex): Reply {
  const body: WriteResult = withDocId(result, docs)
  return {
    status: WRITE_STATUS.get(result.outcome) ?? 200,
    headers: { etag: quoted(result.etag), 'server-timing': serverTiming(timings) },
    body,
  }
}

async function writeFile(request: ApiRequest, { vault, docs }: Services, path: VaultPath): Promise<Reply> {
  request.access.requireWrite(path)
  const precondition = writePrecondition(request.headers)
  return writeReply(await writeFileAs(vault, request.access, { path, bytes: await request.body(), precondition }), docs)
}

async function deleteFile({ headers, access }: ApiRequest, { vault }: Services, path: VaultPath): Promise<Reply> {
  access.requireVaultWrite()
  const ifMatch = entityTag(singleHeader(headers, 'if-match'))
  if (!ifMatch || ifMatch === '*') {
    throw new VaultError(428, 'precondition_required', 'send If-Match with the etag of the file to delete')
  }
  return { status: 200, body: await vault.remove(path, ifMatch, access.coAuthors()) }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value instanceof Object && !Array.isArray(value)
}

function jsonObject(bytes: Buffer): Record<string, unknown> {
  let parsed: unknown
  try {
    parsed = JSON.parse(bytes.toString('utf8'))
  } catch {
    throw invalidRequest('the body is not valid JSON')
  }
  if (isRecord(parsed)) return parsed
  throw invalidRequest('the body must be a JSON object')
}

function optionalString(value: unknown, name: string): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') throw invalidRequest(`${name} must be a string`)
  return value
}

function optionalFlag(value: unknown, name: string): boolean | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'boolean') throw invalidRequest(`${name} must be a boolean`)
  return value
}

function renameOptions(body: Record<string, unknown>): RenameOptions {
  return {
    ifMatch: optionalString(body.ifMatch, 'ifMatch'),
    rewriteLinks: optionalFlag(body.rewriteLinks, 'rewriteLinks'),
    title: optionalString(body.title, 'title'),
    oldTitle: optionalString(body.oldTitle, 'oldTitle'),
  }
}

async function renameFile(request: ApiRequest, { vault, docs }: Services): Promise<Reply> {
  request.access.requireVaultWrite()
  const body = jsonObject(await request.body())
  const result = await vault.rename(vaultPath(body.from), vaultPath(body.to), renameOptions(body), request.access.coAuthors())
  return { status: 200, body: withDocId(result, docs) }
}

async function renameFolder(request: ApiRequest, { vault }: Services): Promise<Reply> {
  request.access.requireVaultWrite()
  const body = jsonObject(await request.body())
  const rewriteLinks = optionalFlag(body.rewriteLinks, 'rewriteLinks')
  const result = await vault.renameFolder(vaultPath(body.from), vaultPath(body.to), { rewriteLinks }, request.access.coAuthors())
  return { status: 200, body: result }
}

async function folderPath(request: ApiRequest): Promise<VaultPath> {
  request.access.requireVaultWrite()
  return vaultPath(jsonObject(await request.body()).path)
}

async function createFolder(request: ApiRequest, { vault }: Services): Promise<Reply> {
  return { status: 201, body: await vault.createFolder(await folderPath(request), request.access.coAuthors()) }
}

async function deleteFolder(request: ApiRequest, { vault }: Services): Promise<Reply> {
  return { status: 200, body: await vault.deleteFolder(await folderPath(request), request.access.coAuthors()) }
}

function searchLimit(raw: string | null): number {
  if (raw === null) return DEFAULT_SEARCH_LIMIT
  const limit = Number(raw)
  if (!Number.isInteger(limit) || limit < 1) throw invalidRequest('limit must be a positive integer')
  return limit
}

async function search({ url, access }: ApiRequest, { search }: Services): Promise<Reply> {
  const limit = searchLimit(url.searchParams.get('limit'))
  return { status: 200, body: await searchAs(search, access, url.searchParams.get('q') ?? '', limit) }
}

async function sync({ access }: ApiRequest, { vault }: Services): Promise<Reply> {
  access.requireSomeWrite()
  return { status: 200, body: await vault.syncNow() }
}

/** Entries of the vault this access may read; the entity tag tells apart what different accesses see. */
async function listEntries({ url, headers, access }: ApiRequest, { index }: Services): Promise<Reply> {
  const since = url.searchParams.get('since')
  const byPath = (entry: { path: string }) => entry.path

  if (since) {
    const delta = await index.getDelta(since)
    const body: EntriesDeltaResponse = {
      ...delta,
      changed: access.visible(delta.changed, byPath),
      deleted: access.visible(delta.deleted, (path) => path),
    }
    return { status: 200, headers: { etag: quoted(delta.head + access.viewTag()) }, body }
  }

  const { head, entries } = index.getAll()
  const body: EntriesResponse = { head, entries: access.visible(entries, byPath) }
  const tag = head + access.viewTag()
  const replyHeaders: Record<string, string> = { etag: quoted(tag) }

  if (entityTag(singleHeader(headers, 'if-none-match')) === tag) {
    return { status: 304, headers: replyHeaders }
  }

  return { status: 200, headers: replyHeaders, body }
}

function collabAccess(value: unknown): CollabAccess {
  if (value === undefined || value === 'write') return 'write'
  if (value === 'read') return 'read'
  throw invalidRequest('access must be "read" or "write"')
}

function collabNotServed(): VaultError {
  return new VaultError(501, 'not_implemented', 'this server does not serve the collaboration channel')
}

/** The channel is a websocket: a plain request for it gets told so. */
async function collabDocument(_request: ApiRequest, { collab }: Services): Promise<Reply> {
  if (!collab) throw collabNotServed()
  const refused = new VaultError(426, 'upgrade_required', 'open this route as a websocket')
  return { ...errorReply(refused), headers: { upgrade: 'websocket', connection: 'Upgrade' } }
}

async function issueTicket(request: ApiRequest, { docs, tickets }: Services): Promise<Reply> {
  if (!tickets) throw collabNotServed()
  const body = jsonObject(await request.body())
  const docId = optionalString(body.docId, 'docId') ?? ''
  const path = docs.pathOf(docId)
  if (!path || !request.access.canRead(path)) throw new VaultError(404, 'not_found', 'no such document')
  const access = collabAccess(body.access)
  if (access === 'write') request.access.requireWrite(path)
  const holder = request.access.subject === null ? undefined : request.access
  return { status: 201, body: tickets.issue({ docId, access, holder }) }
}

function revocationTime(value: unknown): number {
  if (value === undefined || value === null) return Date.now()
  if (Number.isSafeInteger(value)) return value as number
  throw invalidRequest('before must be a time in milliseconds')
}

/** Withdraws what a subject's tickets gave: older tickets stop working, uncovered connections close. */
async function revokeAccess(request: ApiRequest, { revocations }: Services): Promise<Reply> {
  request.access.requireOwner()
  const body = jsonObject(await request.body())
  const subject = optionalString(body.subject, 'subject')
  if (!subject) throw invalidRequest('subject is required')
  const grants = grantsFrom(body.grants)
  if (!grants) throw invalidRequest('grants must be a list of { scope, role } grants')
  const remaining = new Access(subject, grants, 0)
  const result: AccessRevocationResult = { closed: revocations.revoke(subject, { remaining, before: revocationTime(body.before) }) }
  return { status: 200, body: result }
}

const publicRemoteImages = remoteImageFetcher()

/** Stores a public image under `attachments/`, never over an existing file. */
async function importAttachment(request: ApiRequest, { vault, docs, remoteImages }: Services): Promise<Reply> {
  request.access.requireVaultWrite()
  const url = optionalString(jsonObject(await request.body()).url, 'url')
  if (!url) throw invalidRequest('url is required')
  const image = await (remoteImages ?? publicRemoteImages)(url)
  return writeReply(await vault.write(vaultPath(image.path), image.bytes, { kind: 'absent' }, request.access.coAuthors()), docs)
}

async function changeFeed(request: ApiRequest, { changes, revocations }: Services): Promise<Reply> {
  if (!request.response) throw new VaultError(500, 'internal', 'SSE response not available')
  const { access } = request
  const close = changes.connect(request.response, access)
  if (access.subject !== null) {
    const forget = revocations.track(access.subject, { allowedBy: (remaining) => access.coveredBy(remaining), close })
    request.response.once('close', forget)
  }
  // Return a special marker that tells the server not to send anything
  return { status: 200, sse: true }
}

const FILE_METHODS: Methods = new Map([
  ['GET', readFile],
  ['PUT', writeFile],
  ['DELETE', deleteFile],
])
const COLLAB_METHODS: Methods = new Map([['GET', collabDocument]])
const EXACT_ROUTES = new Map<string, Methods>([
  [ROUTES.vault, new Map([['GET', describeVault]])],
  [ROUTES.files, new Map([['GET', listFiles]])],
  [ROUTES.rename, new Map([['POST', renameFile]])],
  [ROUTES.folderRename, new Map([['POST', renameFolder]])],
  [ROUTES.folders, new Map([['POST', createFolder]])],
  [ROUTES.folderDelete, new Map([['POST', deleteFolder]])],
  [ROUTES.search, new Map([['GET', search]])],
  [ROUTES.sync, new Map([['POST', sync]])],
  [ROUTES.entries, new Map([['GET', listEntries]])],
  [ROUTES.changes, new Map([['GET', changeFeed]])],
  [ROUTES.collabTickets, new Map([['POST', issueTicket]])],
  [ROUTES.attachmentImports, new Map([['POST', importAttachment]])],
  [ROUTES.accessRevocations, new Map([['POST', revokeAccess]])],
])

function decodedPath(encoded: string): VaultPath {
  try {
    return vaultPath(decodeURIComponent(encoded))
  } catch (error) {
    if (error instanceof URIError) throw new VaultError(400, 'invalid_path', 'path is not valid percent-encoding')
    throw error
  }
}

interface Resolved {
  methods: Methods
  /** Set for file routes only. */
  path: VaultPath
}

const NO_PATH = '' as VaultPath
const MCP_METHODS: Methods = new Map([['POST', mcpEndpoint]])

function resolveRoute(pathname: string, { mcp }: Services): Resolved | null {
  if (pathname === MCP_PATH) return mcp ? { methods: MCP_METHODS, path: NO_PATH } : null
  const exact = EXACT_ROUTES.get(pathname)
  if (exact) return { methods: exact, path: NO_PATH }
  if (pathname.startsWith(`${ROUTES.files}/`)) {
    return { methods: FILE_METHODS, path: decodedPath(pathname.slice(ROUTES.files.length + 1)) }
  }
  if (pathname.startsWith(`${ROUTES.collabDocs}/`)) return { methods: COLLAB_METHODS, path: NO_PATH }
  return null
}

/** Finds the handler for a request and runs it. Throws `VaultError` for anything it refuses. */
export async function route(request: ApiRequest, services: Services): Promise<Reply> {
  const resolved = resolveRoute(request.url.pathname, services)
  if (!resolved) throw new VaultError(404, 'not_found', `no route for ${request.url.pathname}`)
  const handler = resolved.methods.get(request.method)
  if (handler) return handler(request, services, resolved.path)
  const refused = new VaultError(405, 'method_not_allowed', `${request.method} is not supported here`)
  return { ...errorReply(refused), headers: { allow: [...resolved.methods.keys()].join(', ') } }
}
