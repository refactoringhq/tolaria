import { test, expect } from '@playwright/test'
import { WebSocketServer } from 'ws'

const NEW_NOTE_PATH = '/Users/luca/Laputa/note/ai-created-note.md'
const NEW_NOTE_TITLE = 'AI Created Note'
const NEW_NOTE_CONTENT = `---
title: ${NEW_NOTE_TITLE}
type: Note
---

# ${NEW_NOTE_TITLE}

This note was created by the AI agent.
`

function broadcast(wss: WebSocketServer, data: Record<string, unknown>) {
  const msg = JSON.stringify(data)
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(msg)
  }
}

/** Wait until at least one WebSocket client connects. */
function waitForClient(wss: WebSocketServer, timeoutMs = 10000): Promise<void> {
  if (wss.clients.size > 0) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('No WS client connected')), timeoutMs)
    wss.on('connection', () => { clearTimeout(timer); resolve() })
  })
}

test.describe('AI-created note visibility', () => {
  let wss: WebSocketServer
  /** When true, the intercepted list_vault response includes the new note. */
  let injectNote = false

  test.beforeEach(async () => {
    wss = new WebSocketServer({ port: 9711 })
  })

  test.afterEach(async () => {
    wss.close()
    await new Promise(r => setTimeout(r, 200))
  })

  test.fixme('vault_changed + open_tab from MCP makes note visible and opens tab', async ({ page }) => {
    // Intercept list_vault API calls. On reload (after vault_changed),
    // the injected note will be included in the response.
    await page.route('**/api/vault/list*', async (route) => {
      const response = await route.fetch()
      if (!injectNote) {
        await route.fulfill({ response })
        return
      }
      const entries = await response.json()
      const now = Date.now()
      entries.push({
        path: NEW_NOTE_PATH, filename: 'ai-created-note.md',
        title: NEW_NOTE_TITLE, isA: null,
        aliases: [], belongsTo: [], relatedTo: [], status: null, owner: null,
        cadence: null, archived: false, trashed: false, trashedAt: null,
        modifiedAt: now, createdAt: now, fileSize: NEW_NOTE_CONTENT.length,
        snippet: 'This note was created by the AI agent.', wordCount: 10,
        relationships: {}, icon: null, color: null, order: null,
        sidebarLabel: null, template: null, sort: null, view: null,
        visible: null, outgoingLinks: [], properties: {},
      })
      await route.fulfill({ json: entries })
    })

    // Intercept content fetch for the new note
    await page.route('**/api/vault/content*ai-created-note*', async (route) => {
      await route.fulfill({ json: { content: NEW_NOTE_CONTENT } })
    })

    // Intercept all-content to include new note
    await page.route('**/api/vault/all-content*', async (route) => {
      const response = await route.fetch()
      if (!injectNote) {
        await route.fulfill({ response })
        return
      }
      const data = await response.json()
      data[NEW_NOTE_PATH] = NEW_NOTE_CONTENT
      await route.fulfill({ json: data })
    })

    await page.goto('/')

    // Wait for note list to render
    const noteList = page.locator('.app__note-list')
    await expect(noteList).toBeVisible()
    await expect(noteList.getByText(NEW_NOTE_TITLE)).not.toBeVisible()

    // Enable injection for subsequent reloads
    injectNote = true

    // Wait for the frontend's useAiActivity WS to connect to our bridge
    await waitForClient(wss)

    // Simulate MCP broadcasting vault_changed then open_tab
    // (This is what happens when Claude Code calls open_note via MCP)
    broadcast(wss, { type: 'ui_action', action: 'vault_changed', path: 'note/ai-created-note.md' })

    // Verify: note appears in note list after vault reload
    await expect(noteList.getByText(NEW_NOTE_TITLE)).toBeVisible({ timeout: 8000 })

    // Send open_tab after vault is reloaded so the entry is in entriesByPath
    broadcast(wss, { type: 'ui_action', action: 'open_tab', path: NEW_NOTE_PATH })

    // Verify: note content is displayed in the editor (proves tab opened)
    await expect(page.getByText('This note was created by the AI agent.')).toBeVisible({ timeout: 8000 })
  })
})
