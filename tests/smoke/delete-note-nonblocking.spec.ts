import { test, expect } from '@playwright/test'
import { APP_COMMAND_IDS } from '../../src/hooks/appCommandCatalog'
import {
  createFixtureVaultCopy,
  openFixtureVaultDesktopHarness,
  removeFixtureVaultCopy,
} from '../helpers/fixtureVault'
import { triggerShortcutCommand } from './testBridge'

let tempVaultDir: string

test.describe('responsive note deletion', () => {
  test.beforeEach(() => {
    tempVaultDir = createFixtureVaultCopy()
  })

  test.afterEach(() => {
    removeFixtureVaultCopy(tempVaultDir)
  })

  test('keyboard delete keeps the app responsive while deletion is in flight @smoke', async ({ page }) => {
    await openFixtureVaultDesktopHarness(page, tempVaultDir)
    await page.getByText('Alpha Project', { exact: true }).first().click()
    await expect(page.getByRole('heading', { name: 'Alpha Project', level: 1 })).toBeVisible({ timeout: 5_000 })

    await page.evaluate(() => {
      const handlers = window.__mockHandlers
      if (!handlers) throw new Error('Mock handlers unavailable for delete override')
      const delayedDelete = (args?: { paths?: string[] }) =>
        new Promise((resolve) => window.setTimeout(() => resolve(args?.paths ?? []), 3_000))
      handlers.batch_delete_notes = delayedDelete
      handlers.batch_delete_notes_async = delayedDelete
    })

    await triggerShortcutCommand(page, APP_COMMAND_IDS.noteDelete)
    await expect(page.getByTestId('confirm-delete-dialog')).toBeVisible({ timeout: 5_000 })

    await expect(page.getByTestId('confirm-delete-btn')).toBeFocused()
    await page.keyboard.press('Enter')

    const progressNotice = page.getByTestId('delete-progress-notice')
    await expect(progressNotice).toContainText('Deleting note...')

    await triggerShortcutCommand(page, APP_COMMAND_IDS.fileQuickOpen)
    const quickOpenInput = page.locator('input[placeholder="Search notes..."]')
    await expect(quickOpenInput).toBeVisible({ timeout: 5_000 })
    await quickOpenInput.fill('Note B')
    await page.keyboard.press('Enter')

    await expect(page.getByRole('heading', { name: 'Note B', level: 1 })).toBeVisible({ timeout: 5_000 })
    await expect(progressNotice).toBeVisible()
    await expect(progressNotice).toHaveCount(0, { timeout: 5_000 })
    await expect(page.getByText('Note permanently deleted')).toBeVisible({ timeout: 5_000 })
  })
})
