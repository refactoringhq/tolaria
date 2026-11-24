// Wire-level constants and shapes of the Tolaria remote protocol (docs/web/protocol.md).
// No runtime dependencies and no Node or DOM APIs: the server and the web client import it as-is.

/** `major.minor`. Minor versions only add; a different major is a different protocol. */
export const PROTOCOL_VERSION = '1.10'
export const PROTOCOL_MAJOR = 1
/** Sent by the server on every response; clients may send it to assert the major they speak. */
export const PROTOCOL_HEADER = 'tolaria-protocol-version'
/** Response header on note reads: the id of the note's collaborative document. */
export const DOC_ID_HEADER = 'tolaria-doc-id'
/** Every route of this major lives under this prefix. */
export const API_PREFIX = '/v1'

export const ROUTES = {
  vault: `${API_PREFIX}/vault`,
  files: `${API_PREFIX}/files`,
  rename: `${API_PREFIX}/rename`,
  /** Renames a folder: every file in it moves in one commit (since 1.7). */
  folderRename: `${API_PREFIX}/folders/rename`,
  /** Creates a folder: one commit adding its `.keep` file (since 1.8). */
  folders: `${API_PREFIX}/folders`,
  /** Deletes a folder: every file in it goes in one commit (since 1.8). */
  folderDelete: `${API_PREFIX}/folders/delete`,
  search: `${API_PREFIX}/search`,
  sync: `${API_PREFIX}/sync`,
  /** Vault index of all entries. Supports ETag and `since` parameter for delta updates. */
  entries: `${API_PREFIX}/entries`,
  /** Server-Sent Events stream of vault changes (commits, pulls, pushes). */
  changes: `${API_PREFIX}/changes`,
  /** Websocket channel: `${collabDocs}/<docId>` carries the y-protocols sync of one note. */
  collabDocs: `${API_PREFIX}/collab/docs`,
  /** Issues a short-lived ticket that opens one websocket, for clients that cannot send headers. */
  collabTickets: `${API_PREFIX}/collab/tickets`,
  /** Downloads a public image into `attachments/` on the server's side (since 1.3). */
  attachmentImports: `${API_PREFIX}/attachments/imports`,
  /** Withdraws access a subject's access tickets gave, open connections included; owner only (since 1.9). */
  accessRevocations: `${API_PREFIX}/access/revocations`,
} as const

/**
 * Format of the Y.Doc behind a note. Bump when the shared types inside the doc change.
 * BlockNote's collaboration binding edits a `Y.XmlFragment`, so the note body is one,
 * not a `Y.Text` of raw markdown.
 */
export const DOC_FORMAT = 'tolaria.blocknote/1'
/** Name of the `Y.XmlFragment` holding the note body: what BlockNote's `collaboration.fragment` binds to. */
export const DOC_BLOCKS_FRAGMENT = 'blocks'
/** Name of the shared type holding the frontmatter, which BlockNote does not model. */
export const DOC_FRONTMATTER_FIELD = 'frontmatter'
/** Name of the `Y.Map` holding `format` and `baseRevision` (etag of the markdown last reconciled). */
export const DOC_META_MAP = 'meta'
/** Keys of the `meta` map. */
export const DOC_META = {
  format: 'format',
  /** Etag of the markdown file the document was last reconciled with. */
  baseRevision: 'baseRevision',
  /**
   * Path of the conflict copy holding a version that could not be merged with the document.
   * Since 1.5 that is the incoming file's version: the document keeps its edits.
   */
  conflictCopy: 'conflictCopy',
} as const

/** First byte (a varint) of every websocket message, as in y-websocket. */
export const COLLAB_MESSAGE = { sync: 0, awareness: 1, queryAwareness: 3 } as const
/**
 * Largest websocket message either side accepts. A server may set a lower limit; a larger
 * message is refused before it is decoded and the connection is closed.
 */
export const COLLAB_MAX_MESSAGE_BYTES = 16 * 1024 * 1024
/** Query parameter carrying a ticket on the websocket URL. */
export const COLLAB_TICKET_PARAM = 'ticket'
/** Websocket close codes the server uses beyond the standard ones. */
export const COLLAB_CLOSE = {
  /** The message could not be read. */
  invalidMessage: 4400,
  /** Nothing arrived on the connection, not even a pong, for the server's idle timeout (since 1.6). */
  idle: 4408,
  /** The note of this document was deleted. */
  gone: 4410,
  /** A change the connection sent is not a valid change to this kind of document. */
  rejectedChange: 4422,
  /** The access this connection was opened with was revoked or reduced (since 1.9). */
  revoked: 4403,
} as const

export type CollabAccess = 'read' | 'write'

export interface CollabTicketRequest {
  docId: string
  /** `read` joins without the ability to edit. Defaults to `write`. */
  access?: CollabAccess
}

export interface CollabTicketResponse {
  ticket: string
  /** ISO 8601 time after which the ticket is refused. */
  expiresAt: string
  /** Websocket path to open, without the ticket parameter. */
  path: string
  access: CollabAccess
}

/**
 * Access tickets (since 1.9): a front end that holds the bearer token signs a ticket that gives
 * one subject (a user) a role on the whole vault or on single notes, and sends it as the bearer
 * credential instead of the token. `ta1.<base64url payload JSON>.<base64url HMAC-SHA256>`; the
 * HMAC covers `ta1.<payload>` and its key is HMAC-SHA256(server token, `ACCESS_TICKET_KEY_LABEL`).
 */
export const ACCESS_TICKET_PREFIX = 'ta1.'
export const ACCESS_TICKET_VERSION = 1
export const ACCESS_TICKET_KEY_LABEL = 'tolaria access ticket v1'
/** Longest a ticket may live (`exp - iat`). */
export const ACCESS_TICKET_MAX_LIFETIME_MS = 10 * 60 * 1000
export const ACCESS_TICKET_MAX_GRANTS = 100
/** Longest accepted ticket, in characters. */
export const ACCESS_TICKET_MAX_LENGTH = 16 * 1024
/** The scope of a grant on the whole vault; any other scope is the path of one note. */
export const ACCESS_VAULT_SCOPE = '*'
/** Weakest first. `owner` is only valid on the vault scope. */
export const ACCESS_ROLES = ['viewer', 'editor', 'owner'] as const
export type AccessRole = (typeof ACCESS_ROLES)[number]

export interface AccessGrant {
  /** `*` for the whole vault, or a note path. */
  scope: string
  role: AccessRole
}

/** Longest `author.name` and `author.email` of an access ticket (since 1.10). */
export const ACCESS_AUTHOR_MAX_NAME_LENGTH = 100
export const ACCESS_AUTHOR_MAX_EMAIL_LENGTH = 254

/**
 * Who the subject is in git (since 1.10): the commits the subject's changes cause name it in a
 * `Co-authored-by: <name> <<email>>` trailer. One line each, no control characters or angle brackets.
 */
export interface AccessTicketAuthor {
  name: string
  email: string
}

/** The signed payload of an access ticket. Unknown fields are ignored. */
export interface AccessTicketPayload {
  v: typeof ACCESS_TICKET_VERSION
  /** Stable id of the user the ticket was minted for. */
  sub: string
  grants: AccessGrant[]
  /** Milliseconds since the epoch, on the minting front end's clock. */
  iat: number
  exp: number
  /** Optional (since 1.10); a ticket without it changes files without naming the subject. */
  author?: AccessTicketAuthor
}

/** What the caller of `GET /v1/vault` may do: `subject` is null for the bearer token (the owner). */
export interface VaultAccess {
  subject: string | null
  grants: AccessGrant[]
}

export interface AccessRevocationRequest {
  subject: string
  /** What the subject still holds; open connections these do not cover are closed. Default none. */
  grants?: AccessGrant[]
  /** Tickets of the subject issued at or before this time (ms, minting clock) are refused. Default now. */
  before?: number
}

export interface AccessRevocationResult {
  /** Websockets and change feeds that were closed. */
  closed: number
}

export const FILE_CAPABILITIES = [
  'files.read',
  'files.write',
  'files.rename',
  'files.delete',
  'files.conflict-copy',
  'search.text',
  'sync.git',
  'docs.ids',
  'entries.index',
  'entries.delta',
  'changes.feed',
  'attachments.import',
  'files.rename.links',
  'folders.rename',
  'folders.create',
  'folders.delete',
  'access.tickets',
  'access.authors',
] as const
/** Advertised only by servers that serve the collaboration channel. */
export const COLLAB_CAPABILITIES = ['collab.yjs', 'collab.awareness', 'collab.tickets'] as const

export type Capability =
  | (typeof FILE_CAPABILITIES)[number]
  | (typeof COLLAB_CAPABILITIES)[number]

export interface CollabInfo {
  /** False while the channel is reserved but not served. */
  available: boolean
  /** Websocket path prefix; append `/<docId>`. */
  path: string
  docFormat: string
  blocksFragment: string
  frontmatterField: string
  metaMap: string
}

export interface VaultResponse {
  protocolVersion: string
  capabilities: Capability[]
  vault: { name: string; branch: string; head: string }
  collab: CollabInfo
  /** What this caller may do (since 1.9). */
  access?: VaultAccess
}

export interface FileEntry {
  path: string
  size: number
  /** Opaque revision of the file content. Send it back as `If-Match` when writing. */
  etag: string
  /** Stable id of the note's collaborative document; survives renames. Notes only. */
  docId?: string
}

export interface ListResponse {
  /** Commit the listing was taken from. */
  head: string
  files: FileEntry[]
}

export type WriteOutcome = 'created' | 'updated' | 'unchanged' | 'recreated' | 'conflict'

/** Body of `POST /v1/attachments/imports`; the answer is a `WriteResult` for the stored image. */
export interface AttachmentImportRequest {
  url: string
}

export interface WriteResult {
  outcome: WriteOutcome
  /** Where the bytes of this request now live (the conflict copy when `outcome` is "conflict"). */
  path: string
  etag: string
  commit: string
  /** False when the commit is safe on the server but not yet on the git remote. */
  pushed: boolean
  docId?: string
  /** Only on conflict: the version that kept the requested path. */
  current?: { path: string; etag: string }
}

export interface RenameRequest {
  from: string
  to: string
  /** Etag of `from` the client last saw; omit to rename whatever is there. */
  ifMatch?: string
  /** Since 1.4: rewrite the wikilinks to the note across the vault, in the rename's commit. */
  rewriteLinks?: boolean
  /** Since 1.4: the note's new title, set as its `title` property when it differs from the old one. */
  title?: string
  /** Since 1.4: the old title that links use; the title read from the note when omitted. */
  oldTitle?: string
}

export interface RenameResult {
  from: string
  path: string
  etag: string
  commit: string
  pushed: boolean
  docId?: string
  /** Since 1.4, with `rewriteLinks`: the other notes whose wikilinks were rewritten. */
  rewritten?: string[]
}

/** Body of `POST /v1/folders/rename` (since 1.7): `from` and `to` are folder paths. */
export interface FolderRenameRequest {
  from: string
  to: string
  /** Rewrite the wikilinks that reach a moved note by its path, in the rename's commit. */
  rewriteLinks?: boolean
}

export interface FolderRenameResult {
  from: string
  path: string
  commit: string
  pushed: boolean
  /** Every file that moved, where it was and where it is. */
  moved: { from: string; to: string }[]
  /** With `rewriteLinks`: the notes whose wikilinks were rewritten. */
  rewritten?: string[]
}

/**
 * Body of `POST /v1/folders` and of `POST /v1/folders/delete` (since 1.8): `path` is the
 * folder's path.
 */
export interface FolderRequest {
  path: string
}

/** Git keeps no empty folder: a folder created through the protocol holds this empty file. */
export const FOLDER_KEEP_FILE = '.keep'

export interface FolderCreateResult {
  path: string
  commit: string
  pushed: boolean
}

export interface FolderDeleteResult {
  path: string
  commit: string
  pushed: boolean
  /** Every file that was deleted. */
  deleted: string[]
}

export interface DeleteResult {
  path: string
  commit: string
  pushed: boolean
}

export interface SearchMatch {
  line: number
  text: string
}

export interface SearchResult {
  path: string
  pathMatch: boolean
  matches: SearchMatch[]
}

export interface SearchResponse {
  results: SearchResult[]
  truncated: boolean
}

export interface SyncResult {
  head: string
  /** False when the git remote could not be reached; the server keeps serving its copy. */
  pulled: boolean
  pushed: boolean
}

export type FileKind = 'markdown' | 'text' | 'binary'

export interface VaultEntry {
  path: string
  filename: string
  title: string
  isA?: string
  aliases?: string[]
  belongsTo?: string[]
  status?: string
  fileSize: number
  snippet: string
  relationships?: Record<string, string[]>
  wordCount: number
  outgoingLinks?: string[]
  hasH1: boolean
  fileKind: FileKind
}

export interface EntriesResponse {
  head: string
  entries: VaultEntry[]
}

export interface EntriesDeltaResponse {
  head: string
  changed: VaultEntry[]
  deleted: string[]
}

export const ERROR_CODES = [
  'unauthorized',
  'invalid_path',
  'invalid_request',
  'not_found',
  'method_not_allowed',
  'destination_exists',
  'precondition_required',
  'precondition_failed',
  'payload_too_large',
  'unsupported_protocol_version',
  'not_implemented',
  'upgrade_required',
  'remote_unavailable',
  /** Too many requests for this account; `Retry-After` says when to try again (since 1.6). */
  'rate_limited',
  /** The access ticket does not allow this (since 1.9). */
  'forbidden',
  'internal',
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]

export interface ErrorBody {
  error: { code: ErrorCode; message: string; details?: unknown }
}

/**
 * Server-Sent Event types emitted by the change feed (GET /v1/changes).
 * Clients learn about commits, pulls, and push results in real time.
 */
export type ChangeEventType = 'commit' | 'pull' | 'push-success' | 'push-failed'

export interface ChangeEvent {
  type: ChangeEventType
  /** Commit SHA after the change (commit/pull), or the SHA that failed to push. */
  head: string
  /** Only for 'commit': paths that were added, modified, or deleted. */
  paths?: string[]
  /** Only for 'push-failed': error message. */
  error?: string
}

/** A client can talk to a server when both speak the same major version. */
export function isSupportedProtocolVersion(version: string): boolean {
  const match = /^(\d{1,4})\.\d{1,4}$/.exec(version.trim())
  return match !== null && Number(match[1]) === PROTOCOL_MAJOR
}

export function hasCapability(vault: Pick<VaultResponse, 'capabilities'>, capability: Capability): boolean {
  return vault.capabilities.includes(capability)
}
