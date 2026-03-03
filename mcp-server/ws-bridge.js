#!/usr/bin/env node
/**
 * WebSocket bridge for Laputa MCP tools.
 *
 * Exposes vault operations over WebSocket so the Laputa app frontend
 * can invoke MCP tools in real-time without going through stdio.
 *
 * Port 9710: Tool bridge — Claude/AI clients call vault tools here.
 * Port 9711: UI bridge — Frontend listens for UI action broadcasts.
 *
 * Usage:
 *   VAULT_PATH=/path/to/vault WS_PORT=9710 WS_UI_PORT=9711 node ws-bridge.js
 *
 * Protocol (tool bridge):
 *   Client sends:  { "id": "req-1", "tool": "search_notes", "args": { "query": "test" } }
 *   Server sends:  { "id": "req-1", "result": { ... } }
 *   On error:      { "id": "req-1", "error": "message" }
 *
 * Protocol (UI bridge):
 *   Server broadcasts: { "type": "ui_action", "action": "open_note", "path": "..." }
 */
import { createServer } from 'node:http'
import { WebSocketServer } from 'ws'
import {
  readNote, createNote, searchNotes, appendToNote,
  editNoteFrontmatter, deleteNote, linkNotes, listNotes, vaultContext,
} from './vault.js'

const VAULT_PATH = process.env.VAULT_PATH || process.env.HOME + '/Laputa'
const WS_PORT = parseInt(process.env.WS_PORT || '9710', 10)
const WS_UI_PORT = parseInt(process.env.WS_UI_PORT || '9711', 10)

/** @type {WebSocketServer | null} */
let uiBridge = null

function broadcastUiAction(action, payload) {
  if (!uiBridge) return
  const msg = JSON.stringify({ type: 'ui_action', action, ...payload })
  for (const client of uiBridge.clients) {
    if (client.readyState === 1) client.send(msg)
  }
}

function buildFrontmatter(args) {
  const fm = {}
  if (args.is_a) fm.is_a = args.is_a
  return fm
}

const TOOL_HANDLERS = {
  open_note: (args) => readNote(VAULT_PATH, args.path).then(text => ({ content: text })),
  read_note: (args) => readNote(VAULT_PATH, args.path).then(text => ({ content: text })),
  create_note: (args) => createNote(VAULT_PATH, args.path, args.title, buildFrontmatter(args)),
  search_notes: (args) => searchNotes(VAULT_PATH, args.query, args.limit),
  append_to_note: (args) => appendToNote(VAULT_PATH, args.path, args.text).then(() => ({ ok: true })),
  edit_note_frontmatter: (args) => editNoteFrontmatter(VAULT_PATH, args.path, args.patch),
  delete_note: (args) => deleteNote(VAULT_PATH, args.path).then(() => ({ ok: true })),
  link_notes: (args) => linkNotes(VAULT_PATH, args.source_path, args.property, args.target_title),
  list_notes: (args) => listNotes(VAULT_PATH, args.type_filter, args.sort),
  vault_context: () => vaultContext(VAULT_PATH),
  ui_open_note: (args) => { broadcastUiAction('open_note', { path: args.path }); return { ok: true } },
  ui_open_tab: (args) => { broadcastUiAction('open_tab', { path: args.path }); return { ok: true } },
  ui_highlight: (args) => { broadcastUiAction('highlight', { element: args.element, path: args.path }); return { ok: true } },
  ui_set_filter: (args) => { broadcastUiAction('set_filter', { type: args.type }); return { ok: true } },
}

async function handleMessage(data) {
  const msg = JSON.parse(data)
  const { id, tool, args } = msg

  const handler = TOOL_HANDLERS[tool]
  if (!handler) {
    return { id, error: `Unknown tool: ${tool}` }
  }

  try {
    const result = await handler(args || {})
    return { id, result }
  } catch (err) {
    return { id, error: err.message }
  }
}

/**
 * Attempt to start the UI bridge WebSocket server.
 * Returns a Promise that resolves to the WebSocketServer or null if the port
 * is unavailable (e.g. another Laputa instance owns it).
 */
export function startUiBridge(port = WS_UI_PORT) {
  return new Promise((resolve) => {
    const httpServer = createServer()

    httpServer.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`[ws-bridge] UI bridge port ${port} already in use, disabling bridge`)
      } else {
        console.error(`[ws-bridge] UI bridge error: ${err.message}`)
      }
      resolve(null)
    })

    httpServer.listen(port, () => {
      const wss = new WebSocketServer({ server: httpServer })
      wss.on('connection', () => {
        console.error(`[ws-bridge] UI client connected on port ${port}`)
      })
      uiBridge = wss
      console.error(`[ws-bridge] UI bridge listening on ws://localhost:${port}`)
      resolve(wss)
    })
  })
}

export function startBridge(port = WS_PORT) {
  const wss = new WebSocketServer({ port })

  wss.on('connection', (ws) => {
    console.error(`[ws-bridge] Client connected (vault: ${VAULT_PATH})`)

    ws.on('message', async (raw) => {
      try {
        const response = await handleMessage(raw.toString())
        ws.send(JSON.stringify(response))
      } catch (err) {
        ws.send(JSON.stringify({ error: `Parse error: ${err.message}` }))
      }
    })

    ws.on('close', () => console.error('[ws-bridge] Client disconnected'))
  })

  console.error(`[ws-bridge] Listening on ws://localhost:${port}`)
  return wss
}

// Run directly if invoked as main module
const isMain = process.argv[1]?.endsWith('ws-bridge.js')
if (isMain) {
  startUiBridge().then(() => startBridge())
}
