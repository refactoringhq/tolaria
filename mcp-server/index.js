#!/usr/bin/env node
/**
 * Laputa MCP Server — provides vault operation tools for AI assistants.
 *
 * Usage:
 *   VAULT_PATH=/path/to/vault node index.js
 *
 * Tools:
 *   - open_note / read_note: Read a note by path
 *   - create_note: Create a new note with title and optional frontmatter
 *   - search_notes: Search notes by title or content
 *   - append_to_note: Append text to an existing note
 *   - edit_note_frontmatter: Merge a patch into a note's YAML frontmatter
 *   - delete_note: Delete a note file
 *   - link_notes: Add a title to an array property in a note's frontmatter
 *   - list_notes: List all notes, optionally filtered by type
 *   - vault_context: Get vault types and recent notes
 *   - ui_open_note / ui_open_tab / ui_highlight / ui_set_filter: UI actions
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import {
  readNote, createNote, searchNotes, appendToNote,
  editNoteFrontmatter, deleteNote, linkNotes, listNotes, vaultContext,
} from './vault.js'
import { startUiBridge } from './ws-bridge.js'

const VAULT_PATH = process.env.VAULT_PATH || process.env.HOME + '/Laputa'
const WS_UI_PORT = parseInt(process.env.WS_UI_PORT || '9711', 10)

// Start the UI bridge so stdio-based MCP tools can broadcast UI actions.
// If the port is already in use (e.g. by the running Laputa app), continue
// without the bridge — vault tools still work via stdio MCP.
let uiBridge = null
startUiBridge(WS_UI_PORT).then((bridge) => {
  uiBridge = bridge
})

function broadcastUiAction(action, payload) {
  if (!uiBridge) return
  const msg = JSON.stringify({ type: 'ui_action', action, ...payload })
  for (const client of uiBridge.clients) {
    if (client.readyState === 1) client.send(msg)
  }
}

const TOOLS = [
  {
    name: 'open_note',
    description: 'Open and read a note from the vault by its relative path',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path to the note (e.g. "project/my-project.md")' },
      },
      required: ['path'],
    },
  },
  {
    name: 'read_note',
    description: 'Read the full content of a note',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path to the note' },
      },
      required: ['path'],
    },
  },
  {
    name: 'create_note',
    description: 'Create a new note in the vault with a title and optional frontmatter',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path for the new note (e.g. "note/my-idea.md")' },
        title: { type: 'string', description: 'Title of the note' },
        is_a: { type: 'string', description: 'Entity type (Project, Note, Experiment, etc.)' },
      },
      required: ['path', 'title'],
    },
  },
  {
    name: 'search_notes',
    description: 'Search notes in the vault by title or content',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query string' },
        limit: { type: 'number', description: 'Maximum number of results (default: 10)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'append_to_note',
    description: 'Append text to the end of an existing note',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path to the note' },
        text: { type: 'string', description: 'Text to append' },
      },
      required: ['path', 'text'],
    },
  },
  {
    name: 'edit_note_frontmatter',
    description: 'Merge a patch object into a note\'s YAML frontmatter',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path to the note' },
        patch: { type: 'object', description: 'Key-value pairs to merge into frontmatter' },
      },
      required: ['path', 'patch'],
    },
  },
  {
    name: 'delete_note',
    description: 'Delete a note file from the vault',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path to the note to delete' },
      },
      required: ['path'],
    },
  },
  {
    name: 'link_notes',
    description: 'Add a target title to an array property in a note\'s frontmatter (e.g. add "Marco" to people: [])',
    inputSchema: {
      type: 'object',
      properties: {
        source_path: { type: 'string', description: 'Relative path to the source note' },
        property: { type: 'string', description: 'Frontmatter property name (e.g. "people", "tags")' },
        target_title: { type: 'string', description: 'Title to add to the array' },
      },
      required: ['source_path', 'property', 'target_title'],
    },
  },
  {
    name: 'list_notes',
    description: 'List all notes in the vault, optionally filtered by type frontmatter field',
    inputSchema: {
      type: 'object',
      properties: {
        type_filter: { type: 'string', description: 'Filter by type frontmatter value' },
        sort: { type: 'string', enum: ['title', 'mtime'], description: 'Sort order (default: title)' },
      },
    },
  },
  {
    name: 'vault_context',
    description: 'Get vault context: unique entity types and 20 most recently modified notes',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'ui_open_note',
    description: 'Open a note in the Laputa UI editor',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path to the note' },
      },
      required: ['path'],
    },
  },
  {
    name: 'ui_open_tab',
    description: 'Open a note in a new tab in the Laputa UI',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path to the note' },
      },
      required: ['path'],
    },
  },
  {
    name: 'ui_highlight',
    description: 'Highlight a UI element in the Laputa interface',
    inputSchema: {
      type: 'object',
      properties: {
        element: { type: 'string', enum: ['editor', 'tab', 'properties', 'notelist'], description: 'UI element to highlight' },
        path: { type: 'string', description: 'Relative path to the note (optional)' },
      },
      required: ['element'],
    },
  },
  {
    name: 'ui_set_filter',
    description: 'Set the sidebar filter to show notes of a specific type',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'Type to filter by' },
      },
      required: ['type'],
    },
  },
]

const TOOL_HANDLERS = {
  open_note: handleReadNote,
  read_note: handleReadNote,
  create_note: handleCreateNote,
  search_notes: handleSearchNotes,
  append_to_note: handleAppendToNote,
  edit_note_frontmatter: handleEditFrontmatter,
  delete_note: handleDeleteNote,
  link_notes: handleLinkNotes,
  list_notes: handleListNotes,
  vault_context: handleVaultContext,
  ui_open_note: handleUiOpenNote,
  ui_open_tab: handleUiOpenTab,
  ui_highlight: handleUiHighlight,
  ui_set_filter: handleUiSetFilter,
}

async function handleReadNote(args) {
  const content = await readNote(VAULT_PATH, args.path)
  return { content: [{ type: 'text', text: content }] }
}

async function handleCreateNote(args) {
  const frontmatter = {}
  if (args.is_a) frontmatter.is_a = args.is_a
  const absPath = await createNote(VAULT_PATH, args.path, args.title, frontmatter)
  return { content: [{ type: 'text', text: `Created note at ${absPath}` }] }
}

async function handleSearchNotes(args) {
  const results = await searchNotes(VAULT_PATH, args.query, args.limit)
  const text = results.length === 0
    ? 'No matching notes found.'
    : results.map(r => `**${r.title}** (${r.path})\n${r.snippet}`).join('\n\n')
  return { content: [{ type: 'text', text }] }
}

async function handleAppendToNote(args) {
  await appendToNote(VAULT_PATH, args.path, args.text)
  return { content: [{ type: 'text', text: `Appended text to ${args.path}` }] }
}

async function handleEditFrontmatter(args) {
  const updated = await editNoteFrontmatter(VAULT_PATH, args.path, args.patch)
  return { content: [{ type: 'text', text: JSON.stringify(updated) }] }
}

async function handleDeleteNote(args) {
  await deleteNote(VAULT_PATH, args.path)
  return { content: [{ type: 'text', text: `Deleted ${args.path}` }] }
}

async function handleLinkNotes(args) {
  const arr = await linkNotes(VAULT_PATH, args.source_path, args.property, args.target_title)
  return { content: [{ type: 'text', text: `${args.property}: [${arr.join(', ')}]` }] }
}

async function handleListNotes(args) {
  const notes = await listNotes(VAULT_PATH, args.type_filter, args.sort)
  const text = notes.length === 0
    ? 'No notes found.'
    : notes.map(n => `${n.title} (${n.path})${n.type ? ` [${n.type}]` : ''}`).join('\n')
  return { content: [{ type: 'text', text }] }
}

async function handleVaultContext() {
  const ctx = await vaultContext(VAULT_PATH)
  return { content: [{ type: 'text', text: JSON.stringify(ctx, null, 2) }] }
}

function handleUiOpenNote(args) {
  broadcastUiAction('open_note', { path: args.path })
  return { content: [{ type: 'text', text: `Opening ${args.path} in UI` }] }
}

function handleUiOpenTab(args) {
  broadcastUiAction('open_tab', { path: args.path })
  return { content: [{ type: 'text', text: `Opening tab for ${args.path}` }] }
}

function handleUiHighlight(args) {
  broadcastUiAction('highlight', { element: args.element, path: args.path })
  return { content: [{ type: 'text', text: `Highlighting ${args.element}` }] }
}

function handleUiSetFilter(args) {
  broadcastUiAction('set_filter', { type: args.type })
  return { content: [{ type: 'text', text: `Filter set to ${args.type}` }] }
}

// --- Server setup ---

const server = new Server(
  { name: 'laputa-mcp-server', version: '0.1.0' },
  { capabilities: { tools: {} } },
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params
  const handler = TOOL_HANDLERS[name]
  if (!handler) {
    throw new Error(`Unknown tool: ${name}`)
  }
  try {
    return await handler(args)
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    }
  }
})

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error(`Laputa MCP server running (vault: ${VAULT_PATH})`)
}

main().catch(console.error)
