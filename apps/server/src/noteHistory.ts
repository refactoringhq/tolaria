import type { NoteCheckpoint } from '../../../packages/protocol/src/index.ts'
import { VaultError } from './errors.ts'
import type { GitRepo } from './gitRepo.ts'
import { isNote, type VaultPath } from './paths.ts'

/**
 * The checkpoints of a note (protocol 1.11, TOL-421). Today a checkpoint is a commit that
 * touched the note's file; its id is the commit id, which clients treat as opaque, so the
 * store behind it can change without changing the protocol.
 */

/** A full commit id (SHA-1 or SHA-256): never an option or a revision expression. */
const COMMIT_ID = /^([0-9a-f]{40}|[0-9a-f]{64})$/
const FIELD = '\x1f'
const RECORD = '\x1e'
const TRAILER = '\x1d'
const LOG_FORMAT = `${['%H', '%cI', '%an', '%s', '%(trailers:key=Co-authored-by,valueonly,separator=%x1d)'].join('%x1f')}%x1e`
/** `git cat-file` exits with 128 when the object (here the note at a commit) does not exist. */
const MISSING_OBJECT = 128

/** A checkpoint id from a request: a full commit id, refused otherwise. */
export function checkpointId(value: unknown): string {
  if (typeof value === 'string' && COMMIT_ID.test(value)) return value
  throw new VaultError(400, 'invalid_request', 'checkpoint must be a checkpoint id from the note history')
}

/** History is kept for notes: their bytes travel as text. */
export function requireNote(path: VaultPath): VaultPath {
  if (isNote(path)) return path
  throw new VaultError(400, 'invalid_request', 'history is only kept for notes')
}

/** `Ana <ana@example.com>` -> `Ana`: the first co-author of a change. */
function coAuthorName(trailers: string): string {
  const first = trailers.split(TRAILER)[0] ?? ''
  const bracket = first.indexOf('<')
  return (bracket < 0 ? first : first.slice(0, bracket)).trim()
}

function parseCheckpoint(record: string): NoteCheckpoint | null {
  const [id, time, committer, message, trailers] = record.trim().split(FIELD)
  if (!id || !COMMIT_ID.test(id)) return null
  return { id, time, author: coAuthorName(trailers ?? '') || committer, message }
}

/** The checkpoints of the note at `path`, newest first. */
export async function checkpointsOf(repo: GitRepo, path: VaultPath, limit: number): Promise<NoteCheckpoint[]> {
  const log = await repo.run(['log', `--max-count=${limit}`, `--format=${LOG_FORMAT}`, 'HEAD', '--', path])
  return log.stdout.split(RECORD).flatMap((record) => parseCheckpoint(record) ?? [])
}

/** The note's content at a checkpoint; null where the note did not exist then. */
export async function contentAt(repo: GitRepo, path: VaultPath, checkpoint: string): Promise<Buffer | null> {
  const object = await repo.run(['cat-file', 'blob', `${checkpointId(checkpoint)}:${path}`], { okCodes: [MISSING_OBJECT] })
  return object.code === MISSING_OBJECT ? null : Buffer.from(object.stdout, 'utf8')
}

/** The commit message of a restore. */
export function restoreMessage(path: VaultPath, checkpoint: string): string {
  return `Restore ${path} from ${checkpoint.slice(0, 12)}`
}
