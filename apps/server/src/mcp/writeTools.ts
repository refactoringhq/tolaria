import { posix } from 'node:path'
import { stale, VaultError } from '../errors.ts'
import { invalidRequest, updateFileAs, writeFileAs } from '../operations.ts'
import type { VaultPath } from '../paths.ts'
import type { TimedWriteResult } from '../vault.ts'
import type { WriteResult } from '../../../../packages/protocol/src/index.ts'
import { notePath } from './readTools.ts'
import { errorResult, jsonResult, stringArg, type ToolArgs, type ToolHandler, type ToolResult } from './results.ts'

function alreadyExists(path: VaultPath): VaultError {
  return new VaultError(409, 'destination_exists', `${path} already exists: use update_note or append_to_note to change it`)
}

/** What the agent learns of a write. A conflict copy is not a success: it says where the content went. */
function writeResult(requested: VaultPath, written: TimedWriteResult): ToolResult {
  const { outcome, path, etag, commit, pushed, current } = written
  // Undefined `current` is left out of the JSON.
  const result: WriteResult = { outcome, path, etag, commit, pushed, current }
  if (result.outcome !== 'conflict') return jsonResult(result)
  const kept = result.current ? ` The version at ${requested} was kept (etag ${result.current.etag}).` : ''
  return errorResult(
    `${requested} changed on the server before this write landed, so the content was saved as the conflict copy ` +
      `${result.path}.${kept} Read both notes and merge them.\n${JSON.stringify(result, null, 2)}`,
  )
}

function yamlScalar(value: string): string {
  return JSON.stringify(value)
}

/** The note the desktop server writes when create_note is given no content. */
function startingContent(args: ToolArgs, path: VaultPath): string {
  const title = stringArg(args, 'title').trim() || posix.basename(path, '.md')
  const type = stringArg(args, 'type').trim() || 'Note'
  return `---\ntype: ${yamlScalar(type)}\n---\n\n# ${title}\n`
}

function requiredContent(args: ToolArgs): Buffer {
  const content = stringArg(args, 'content')
  if (content === '') throw invalidRequest('content is required')
  return Buffer.from(content)
}

async function refuseExisting(read: () => Promise<unknown>, path: VaultPath): Promise<void> {
  try {
    await read()
  } catch (error) {
    if (error instanceof VaultError && error.status === 404) return
    throw error
  }
  throw alreadyExists(path)
}

/**
 * `PUT` with `If-None-Match: *`. A file already in the clone is refused before anything is
 * written; one that only arrives with the pull becomes a conflict copy, as over REST.
 */
const createNote: ToolHandler = async (args, { services, access }) => {
  access.requireVaultWrite()
  const path = notePath(stringArg(args, 'path'))
  const content = stringArg(args, 'content').trim() ? stringArg(args, 'content') : startingContent(args, path)
  await refuseExisting(() => services.vault.read(path), path)
  const written = await writeFileAs(services.vault, access, { path, bytes: Buffer.from(content), precondition: { kind: 'absent' } })
  return writeResult(path, written)
}

const updateNote: ToolHandler = async (args, { services, access }) => {
  const path = notePath(stringArg(args, 'path'))
  const bytes = requiredContent(args)
  const expected = stringArg(args, 'expectedEtag')
  const written = await updateFileAs(services.vault, access, path, (current) => {
    if (expected && current.etag !== expected) throw stale(path, current.etag)
    return bytes
  })
  return writeResult(path, written)
}

const appendToNote: ToolHandler = async (args, { services, access }) => {
  const path = notePath(stringArg(args, 'path'))
  const addition = requiredContent(args)
  const written = await updateFileAs(services.vault, access, path, (current) => Buffer.concat([current.bytes, addition]))
  return writeResult(path, written)
}

export const WRITE_TOOLS: readonly [string, ToolHandler][] = [
  ['create_note', createNote],
  ['update_note', updateNote],
  ['append_to_note', appendToNote],
]
