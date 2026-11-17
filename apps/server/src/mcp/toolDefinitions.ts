/**
 * The tools the remote offers over MCP: the names, argument names and annotations of the
 * desktop server (`mcp-server/index.js`), without `vaultPath` because the remote serves one
 * vault, and with git revisions (`etag`) where the desktop has file times (`mtimeMs`).
 */

export type ArgumentType = 'string' | 'number'

export interface ToolDefinition {
  name: string
  description: string
  annotations: {
    readOnlyHint: boolean
    destructiveHint: boolean
    idempotentHint: boolean
    openWorldHint: boolean
  }
  inputSchema: {
    type: 'object'
    properties: Record<string, { type: ArgumentType; description: string }>
    required?: string[]
  }
}

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }

const NOTE_PATH = { type: 'string', description: 'Path of the note inside the vault (e.g. "project/my-project.md")' } as const

export const TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  {
    name: 'search_notes',
    description: 'Full-text search across vault notes by title or content. Returns matching paths, titles, and snippets.',
    annotations: READ_ONLY,
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query string (one line)' },
        limit: { type: 'number', description: 'Maximum number of results (default: 10)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_vault_context',
    description:
      'Get vault orientation: name, branch, entity types, AGENTS.md instructions, note count, folders, and recent notes.',
    annotations: READ_ONLY,
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_vaults',
    description: 'List the vault this server serves, including whether it has AGENTS.md instructions.',
    annotations: READ_ONLY,
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_note',
    description:
      'Read a note with parsed YAML frontmatter, markdown content, and etag for conflict-guarded edits. Returns {path, frontmatter, content, etag}.',
    annotations: READ_ONLY,
    inputSchema: { type: 'object', properties: { path: NOTE_PATH }, required: ['path'] },
  },
  {
    name: 'create_note',
    description:
      'Create a new markdown note in the vault and commit it. Does not overwrite existing files. Use content for the full markdown including YAML frontmatter and H1.',
    annotations: WRITE,
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path of the new note inside the vault. Must end in .md.' },
        content: { type: 'string', description: 'Full markdown note content, including YAML frontmatter when needed.' },
        title: { type: 'string', description: 'Optional title used only when content is omitted.' },
        type: { type: 'string', description: 'Optional note type used only when content is omitted.' },
      },
      required: ['path'],
    },
  },
  {
    name: 'update_note',
    description:
      'Replace the full content (frontmatter + body) of an existing note and commit it. The note must already exist — use create_note for new notes. Optionally pass expectedEtag (the etag returned by get_note) to fail without writing when the note changed between read and write.',
    annotations: WRITE,
    inputSchema: {
      type: 'object',
      properties: {
        path: NOTE_PATH,
        content: { type: 'string', description: 'Full new markdown note content (frontmatter + body).' },
        expectedEtag: { type: 'string', description: 'Optional etag from get_note. When set, the update fails if the note has changed.' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'append_to_note',
    description:
      'Append markdown to the end of an existing note body and commit it. Lower-risk than update_note for agents that only need to log or extend content. The note must already exist.',
    annotations: WRITE,
    inputSchema: {
      type: 'object',
      properties: {
        path: NOTE_PATH,
        content: { type: 'string', description: 'Markdown to append after the existing body.' },
      },
      required: ['path', 'content'],
    },
  },
]
