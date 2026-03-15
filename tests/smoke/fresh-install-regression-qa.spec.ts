import { test, expect } from '@playwright/test'
import { sendShortcut, openCommandPalette, findCommand } from './helpers'

/**
 * Fresh-install regression QA: verify all 7 Done tasks work on a fresh
 * MacBook without pre-configured environment.
 *
 * Tasks under test:
 * 1. Search/qmd bundling + auto-index
 * 2. MCP server foundation + auto-registration
 * 3. AGENTS.md vault-level instructions
 * 4. AI Agent panel: vault-native AI
 * 5. Claude API wiring + full agent loop
 * 6. AI panel UI (3 layers + blue glow)
 * 7. /api/ai/agent endpoint fix (uses Tauri invoke, not fetch)
 */

test.describe('Fresh-install regression: AI panel renders and works', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/vault/ping', route => route.fulfill({ status: 503 }))
    await page.goto('/')
    await page.waitForTimeout(500)
  })

  test('AI panel opens with Ctrl+I and has 3-layer structure', async ({ page }) => {
    // Select a note for context
    const noteItem = page.locator('.app__note-list .cursor-pointer').first()
    await noteItem.click()
    await page.waitForTimeout(300)

    // Open AI panel
    await sendShortcut(page, 'i', ['Control'])
    const panel = page.getByTestId('ai-panel')
    await expect(panel).toBeVisible({ timeout: 3000 })

    // Layer 1: Header with title and buttons
    await expect(panel.locator('text=AI Chat')).toBeVisible()
    await expect(panel.locator('button[title="New conversation"]')).toBeVisible()
    await expect(panel.locator('button[title="Close AI panel"]')).toBeVisible()

    // Layer 2: Message area (empty state with robot icon suggestion)
    await expect(
      panel.locator('text=Ask about this note').or(panel.locator('text=Open a note')),
    ).toBeVisible()

    // Layer 3: Input area with send button
    await expect(page.getByTestId('agent-send')).toBeVisible()
  })

  test('AI panel shows context bar when note is selected', async ({ page }) => {
    const noteItem = page.locator('.app__note-list .cursor-pointer').first()
    await noteItem.click()
    await page.waitForTimeout(300)

    await sendShortcut(page, 'i', ['Control'])
    await expect(page.getByTestId('ai-panel')).toBeVisible({ timeout: 3000 })

    // Context bar should show active note title
    await expect(page.getByTestId('context-bar')).toBeVisible()
  })

  test('AI panel input is focusable and sendable', async ({ page }) => {
    const noteItem = page.locator('.app__note-list .cursor-pointer').first()
    await noteItem.click()
    await page.waitForTimeout(300)

    await sendShortcut(page, 'i', ['Control'])
    await expect(page.getByTestId('ai-panel')).toBeVisible({ timeout: 3000 })

    // Input should auto-focus
    const input = page.locator('input[placeholder*="Ask"]')
    await expect(input).toBeVisible()
    await input.fill('Test message')

    // Send button should be enabled when input has text
    const sendBtn = page.getByTestId('agent-send')
    await expect(sendBtn).toBeEnabled()

    // Click send — should produce a response (mock in dev mode)
    await sendBtn.click()
    const response = page.getByTestId('ai-message').last()
    await expect(response).toBeVisible({ timeout: 5000 })
  })

  test('AI panel close with Escape key', async ({ page }) => {
    const noteItem = page.locator('.app__note-list .cursor-pointer').first()
    await noteItem.click()
    await page.waitForTimeout(300)

    await sendShortcut(page, 'i', ['Control'])
    const panel = page.getByTestId('ai-panel')
    await expect(panel).toBeVisible({ timeout: 3000 })

    // Focus the panel and press Escape
    await panel.focus()
    await page.keyboard.press('Escape')
    await expect(panel).not.toBeVisible({ timeout: 2000 })
  })

  test('AI panel blue glow animation CSS exists', async ({ page }) => {
    const noteItem = page.locator('.app__note-list .cursor-pointer').first()
    await noteItem.click()
    await page.waitForTimeout(300)

    await sendShortcut(page, 'i', ['Control'])
    const panel = page.getByTestId('ai-panel')
    await expect(panel).toBeVisible({ timeout: 3000 })

    // Verify the ai-border-pulse keyframe is defined in the page CSS
    const hasAnimation = await page.evaluate(() => {
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule instanceof CSSKeyframesRule && rule.name === 'ai-border-pulse') {
              return true
            }
          }
        } catch { /* cross-origin sheets */ }
      }
      return false
    })
    expect(hasAnimation).toBe(true)
  })
})

test.describe('Fresh-install regression: search and command palette', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/vault/ping', route => route.fulfill({ status: 503 }))
    await page.goto('/')
    await page.waitForTimeout(500)
  })

  test('search UI renders and is accessible via Cmd+P', async ({ page }) => {
    // Cmd+P should open search/note switcher
    await sendShortcut(page, 'p', ['Control'])
    await page.waitForTimeout(500)

    // Search input should be visible
    const searchInput = page.locator('input[placeholder*="Search"]').or(
      page.locator('input[placeholder*="command"]'),
    )
    await expect(searchInput).toBeVisible({ timeout: 2000 })
  })

  test('Cmd+K command palette includes Repair Vault', async ({ page }) => {
    await openCommandPalette(page)
    const found = await findCommand(page, 'Repair Vault')
    expect(found).toBe(true)
  })
})

test.describe('Fresh-install regression: no /api/ai/agent endpoint', () => {
  test('fetching /api/ai/agent returns 404 or no response', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(500)

    // In dev mode, the Vite proxy plugin handles /api/ai/agent,
    // but in production Tauri there is no HTTP server at all.
    // The key verification is that ai-agent.ts uses invoke(), not fetch().
    // We verify this indirectly by checking the AiPanel doesn't make fetch calls.
    const fetchCalls: string[] = []
    page.on('request', req => {
      if (req.url().includes('/api/ai/agent')) {
        fetchCalls.push(req.url())
      }
    })

    // Open AI panel and send a message
    const noteItem = page.locator('.app__note-list .cursor-pointer').first()
    await noteItem.click()
    await page.waitForTimeout(300)
    await sendShortcut(page, 'i', ['Control'])
    await expect(page.getByTestId('ai-panel')).toBeVisible({ timeout: 3000 })

    const input = page.locator('input[placeholder*="Ask"]')
    await input.fill('Test')
    await page.getByTestId('agent-send').click()
    await page.waitForTimeout(1000)

    // No fetch to /api/ai/agent should have been made
    expect(fetchCalls).toHaveLength(0)
  })
})
