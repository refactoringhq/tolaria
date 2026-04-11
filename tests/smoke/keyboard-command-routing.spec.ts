import { test, expect } from '@playwright/test'
import { triggerMenuCommand } from './testBridge'
import { createFixtureVaultCopy, openFixtureVaultTauri, removeFixtureVaultCopy } from '../helpers/fixtureVault'

let tempVaultDir: string

test.describe('keyboard command routing', () => {
  test.beforeEach(() => {
    tempVaultDir = createFixtureVaultCopy()
  })

  test.afterEach(() => {
    removeFixtureVaultCopy(tempVaultDir)
  })

  test('native menu trigger creates a note through the shared command path @smoke', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await openFixtureVaultTauri(page, tempVaultDir)
    await triggerMenuCommand(page, 'file-new-note')

    await expect(page.getByTestId('breadcrumb-filename-trigger')).toContainText(/untitled-note-\d+/i, { timeout: 5_000 })
    expect(errors).toEqual([])
  })

  test('Meta+Shift+I toggles the properties panel in Tauri mode through the shared keyboard path @smoke', async ({ page }) => {
    await openFixtureVaultTauri(page, tempVaultDir)
    await page.getByText('Alpha Project', { exact: true }).first().click()
    await page.locator('.bn-editor').click()

    await page.keyboard.press('Meta+Shift+I')
    await expect(page.getByTitle('Close Properties (⌘⇧I)')).toBeVisible({ timeout: 5_000 })

    await page.keyboard.press('Meta+Shift+I')
    await expect(page.getByTitle('Properties (⌘⇧I)')).toBeVisible({ timeout: 5_000 })
  })

  test('native menu trigger toggles organized state through the shared command path @smoke', async ({ page }) => {
    await openFixtureVaultTauri(page, tempVaultDir)
    await page.getByText('Alpha Project', { exact: true }).first().click()
    await page.locator('.bn-editor').click()

    await expect(page.getByTitle('Mark as organized (remove from Inbox) (Cmd+E)')).toBeVisible({ timeout: 5_000 })

    // Chromium reserves Meta+E for the browser chrome, so the exact keystroke
    // needs native-app QA. The smoke suite proves the shared command path here.
    await triggerMenuCommand(page, 'note-toggle-organized')
    await expect(page.getByTitle('Mark as unorganized (back to Inbox) (Cmd+E)')).toBeVisible({ timeout: 5_000 })

    await triggerMenuCommand(page, 'note-toggle-organized')
    await expect(page.getByTitle('Mark as organized (remove from Inbox) (Cmd+E)')).toBeVisible({ timeout: 5_000 })
  })

  test('Meta+Backslash toggles the raw editor in Tauri mode through the shared keyboard path @smoke', async ({ page }) => {
    await openFixtureVaultTauri(page, tempVaultDir)
    await page.getByText('Alpha Project', { exact: true }).first().click()
    await page.locator('.bn-editor').click()

    await page.keyboard.press('Meta+Backslash')
    await expect(page.getByTestId('raw-editor-codemirror')).toBeVisible({ timeout: 5_000 })

    await page.keyboard.press('Meta+Backslash')
    await expect(page.getByTestId('raw-editor-codemirror')).not.toBeVisible({ timeout: 5_000 })
    await expect(page.locator('.bn-editor')).toBeVisible({ timeout: 5_000 })
  })

  test('Meta+Shift+L toggles the AI panel in Tauri mode, while Ctrl+Shift+L does not @smoke', async ({ page }) => {
    await openFixtureVaultTauri(page, tempVaultDir)
    await page.getByText('Alpha Project', { exact: true }).first().click()
    await page.locator('.bn-editor').click()

    await page.keyboard.press('Control+Shift+L')
    await page.waitForTimeout(200)
    await expect(page.getByTestId('ai-panel')).not.toBeVisible()

    await page.keyboard.press('Meta+Shift+L')
    await expect(page.getByTestId('ai-panel')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByTitle('Close AI panel')).toBeVisible()

    await page.keyboard.press('Meta+Shift+L')
    await expect(page.getByTestId('ai-panel')).not.toBeVisible({ timeout: 5_000 })
  })
})
