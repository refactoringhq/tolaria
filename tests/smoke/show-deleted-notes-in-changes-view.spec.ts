import { expect, type Page, test } from '@playwright/test'

import { openCommandPalette, executeCommand } from './helpers'

async function navigateToChanges(page: Page) {
  await openCommandPalette(page)
  await executeCommand(page, 'Go to Changes')
  await page.waitForTimeout(500)
}

test.describe('Show deleted notes in Changes view', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('changes rows show title, filename, and diff summary while keyboard navigation still opens notes', async ({ page }) => {
    await navigateToChanges(page)

    const deletedRow = page.locator('[data-change-status="deleted"]').filter({ hasText: 'Old Draft' }).first()
    await expect(deletedRow).toContainText('Old Draft')
    await expect(deletedRow).toContainText('old-draft.md')
    await expect(deletedRow).toContainText('Diff unavailable')

    const noteList = page.getByTestId('note-list-container')
    await noteList.focus()
    await page.keyboard.press('Enter')

    await expect(page.getByText('Back to editor')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('This note was deleted.')).toBeVisible({ timeout: 5_000 })
  })

  test('changes view shows deleted notes as rows instead of a banner', async ({ page }) => {
    await navigateToChanges(page)
    const deletedRow = page.locator('[data-change-status="deleted"]').filter({ hasText: 'old-draft.md' })
    await expect(deletedRow).toBeVisible({ timeout: 5000 })
    await expect(page.locator('[data-testid="deleted-notes-banner"]')).toHaveCount(0)
  })

  test('clicking a deleted row opens its deleted diff preview', async ({ page }) => {
    await navigateToChanges(page)
    await page.getByText('old-draft.md').click()
    await expect(page.getByText('Back to editor')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('This note was deleted.')).toBeVisible({ timeout: 5000 })
  })

  test('deleted rows expose a restore action from the context menu', async ({ page }) => {
    await navigateToChanges(page)
    await page.getByText('old-draft.md').click({ button: 'right' })
    await expect(page.locator('[data-testid="changes-context-menu"]')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('[data-testid="restore-note-button"]')).toBeVisible({ timeout: 5000 })
  })
})
