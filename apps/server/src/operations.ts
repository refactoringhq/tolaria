import type { SearchResponse } from '../../../packages/protocol/src/index.ts'
import type { Access } from './access.ts'
import { notFound, VaultError } from './errors.ts'
import type { VaultPath } from './paths.ts'
import type { SearchIndex } from './searchIndex.ts'
import type { StoredFile, TimedWriteResult, Vault, WritePrecondition } from './vault.ts'

/**
 * What a request may do with the files of the vault, checked against its access. The REST
 * routes and the MCP tools both go through these, so a file read, written or searched over
 * either one is checked, committed and announced (doc index, search index, live documents,
 * change feed) the same way.
 */

export const MAX_SEARCH_LIMIT = 200
const MAX_QUERY_CHARS = 200

export function invalidRequest(message: string): VaultError {
  return new VaultError(400, 'invalid_request', message)
}

/** A file the access may read; anything else is answered as if it did not exist. */
export function readFileAs(vault: Vault, access: Access, path: VaultPath): Promise<StoredFile> {
  access.requireRead(path)
  return vault.read(path)
}

/** Commits a file as the access, or a conflict copy of it when `precondition` no longer holds. */
export function writeFileAs(
  vault: Vault,
  access: Access,
  write: { path: VaultPath; bytes: Uint8Array; precondition: WritePrecondition },
): Promise<TimedWriteResult> {
  access.requireWrite(write.path)
  return vault.write(write.path, write.bytes, write.precondition, access.coAuthors())
}

/**
 * Rewrites an existing file from its current content, as the access. `change` runs under the
 * vault lock after the pull, so nothing can land between what it reads and what is written;
 * a `VaultError` it throws leaves the vault untouched.
 */
export async function updateFileAs(
  vault: Vault,
  access: Access,
  path: VaultPath,
  change: (current: StoredFile) => Uint8Array,
): Promise<TimedWriteResult> {
  access.requireWrite(path)
  const produce = async (current: StoredFile | null): Promise<Uint8Array> => {
    if (!current) throw notFound(path)
    return change(current)
  }
  const result = await vault.update(path, produce, access.coAuthors())
  // `produce` never skips the write, so the vault always reports one.
  if (!result) throw notFound(path)
  return result
}

function searchQuery(query: string): string {
  const oneLine = !query.includes('\n') && query.length <= MAX_QUERY_CHARS
  if (oneLine && query.trim() !== '') return query
  throw invalidRequest(`q must be one line of 1 to ${MAX_QUERY_CHARS} characters`)
}

/** The search hits the access may read, at most `limit` (capped at `MAX_SEARCH_LIMIT`) before filtering. */
export async function searchAs(search: SearchIndex, access: Access, query: string, limit: number): Promise<SearchResponse> {
  const found = await search.search(searchQuery(query), Math.min(limit, MAX_SEARCH_LIMIT))
  return { ...found, results: access.visible(found.results, (result) => result.path) }
}
