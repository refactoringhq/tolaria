import { test, expect } from '@playwright/test'
import { sendShortcut } from './helpers'

test.describe('AI chat conversation history', () => {
  test.beforeEach(async ({ page }) => {
    // Block vault API so mock entries are used
    await page.route('**/api/vault/ping', route => route.fulfill({ status: 503 }))

    await page.goto('/')
    await page.waitForTimeout(500)

    // Select a note so the AI panel has context
    const noteItem = page.locator('.app__note-list .cursor-pointer').first()
    await noteItem.click()
    await page.waitForTimeout(500)

    // Open AI Chat with Ctrl+I
    await sendShortcut(page, 'i', ['Control'])
    await expect(page.getByTestId('ai-panel')).toBeVisible({ timeout: 3000 })
  })

  test('first message has no conversation history marker', async ({ page }) => {
    // Find the input and send a message
    const input = page.locator('input[placeholder*="Ask"]')
    await input.fill('Hello')
    await page.getByTestId('agent-send').click()

    // Wait for mock response to appear
    const response = page.getByTestId('ai-message').last()
    await expect(response).toBeVisible({ timeout: 5000 })

    // First message should have [mock-no-history] since there's no prior conversation
    await expect(response).toContainText('[mock-no-history]')
  })

  test('second message includes conversation history from first exchange', async ({ page }) => {
    // Send first message
    const input = page.locator('input[placeholder*="Ask"]')
    await input.fill('What is 2+2?')
    await page.getByTestId('agent-send').click()

    // Wait for first response to appear
    const firstResponse = page.getByTestId('ai-message').last()
    await expect(firstResponse).toBeVisible({ timeout: 5000 })
    await expect(firstResponse).toContainText('[mock-no-history]')

    // Send second message
    await input.fill('What was my previous question?')
    await page.getByTestId('agent-send').click()

    // Wait for second response — it should contain history marker
    await page.waitForTimeout(1000)
    const secondResponse = page.getByTestId('ai-message').last()
    await expect(secondResponse).toContainText('[mock-with-history', { timeout: 5000 })
    // turns=2 means 2 [user] lines: original + new question
    await expect(secondResponse).toContainText('turns=2')
  })

  test('history resets after clearing conversation', async ({ page }) => {
    // Send first message
    const input = page.locator('input[placeholder*="Ask"]')
    await input.fill('Hello')
    await page.getByTestId('agent-send').click()

    // Wait for response
    const firstResponse = page.getByTestId('ai-message').last()
    await expect(firstResponse).toBeVisible({ timeout: 5000 })

    // Clear conversation (click the + button)
    await page.locator('button[title="New conversation"]').click()
    await page.waitForTimeout(300)

    // Messages should be cleared
    await expect(page.getByTestId('ai-message')).toHaveCount(0)

    // Send new message — should have no history
    await input.fill('Fresh start')
    await page.getByTestId('agent-send').click()

    const freshResponse = page.getByTestId('ai-message').last()
    await expect(freshResponse).toBeVisible({ timeout: 5000 })
    await expect(freshResponse).toContainText('[mock-no-history]')
  })
})
