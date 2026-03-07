import { test, expect } from '@playwright/test'
import { sendShortcut } from './helpers'

test.describe('AI chat wikilink rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(500)
  })

  test('[[Note]] in AI response renders as clickable wikilink', async ({ page }) => {
    // Select a note first so the AI panel has context
    const noteItem = page.locator('.app__note-list .cursor-pointer').first()
    await noteItem.click()
    await page.waitForTimeout(500)

    // Open AI Chat with Ctrl+I
    await sendShortcut(page, 'i', ['Control'])
    await expect(page.getByTestId('ai-panel')).toBeVisible({ timeout: 3000 })

    // Send a message to get a mock response containing wikilinks
    const input = page.locator('input[placeholder*="Ask"]')
    await input.fill('Tell me about this note')
    await page.getByTestId('agent-send').click()

    // Wait for mock response (contains [[Build Laputa App]] and [[Matteo Cellini]])
    const wikilink = page.locator('.chat-wikilink').first()
    await expect(wikilink).toBeVisible({ timeout: 5000 })

    // Verify wikilink text and attributes
    await expect(wikilink).toHaveText('Build Laputa App')
    await expect(wikilink).toHaveAttribute('data-wikilink-target', 'Build Laputa App')
    await expect(wikilink).toHaveAttribute('role', 'link')

    // Verify second wikilink
    const secondWikilink = page.locator('.chat-wikilink').nth(1)
    await expect(secondWikilink).toHaveText('Matteo Cellini')

    // Verify multiple wikilinks rendered
    const allWikilinks = page.locator('.chat-wikilink')
    await expect(allWikilinks).toHaveCount(2)

    // Verify wikilink has pointer cursor (is styled as clickable)
    const cursor = await wikilink.evaluate(el => getComputedStyle(el).cursor)
    expect(cursor).toBe('pointer')
  })
})
