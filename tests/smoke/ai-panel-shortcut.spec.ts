import { test, expect } from '@playwright/test'
import { sendShortcut } from './helpers'

test.describe('AI panel shortcut', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/vault/ping', route => route.fulfill({ status: 503 }))
    await page.goto('/')
    await expect(page.locator('[data-testid="note-list-container"]')).toBeVisible({ timeout: 5_000 })
  })

  test('Cmd+Shift+L opens the AI panel from the editor', async ({ page }) => {
    await page.locator('.app__note-list .cursor-pointer').first().click()
    await page.locator('.bn-editor').click()
    await sendShortcut(page, 'L', ['Meta', 'Shift'])
    await expect(page.getByTestId('ai-panel')).toBeVisible({ timeout: 3_000 })
    await expect(page.getByTitle('Close AI panel')).toBeVisible()
  })
})
