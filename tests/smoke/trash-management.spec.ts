import { test, expect } from '@playwright/test'
import { openCommandPalette, findCommand, executeCommand } from './helpers'

const TRASHED_TITLES = ['Old Draft Notes', 'Deprecated API Notes', 'Failed SEO Experiment']

async function navigateToTrash(page: import('@playwright/test').Page) {
  const trashNav = page.locator('button, [role="button"]').filter({ hasText: /^Trash/ }).first()
  await trashNav.click()
  await page.waitForTimeout(300)
}

test.describe('Trash management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('trash view shows trashed notes with correct header', async ({ page }) => {
    await navigateToTrash(page)
    await expect(page.locator('text=Trash').first()).toBeVisible()
    const noteItems = page.locator('[data-testid="note-item"]')
    const count = await noteItems.count()
    expect(count).toBeGreaterThanOrEqual(TRASHED_TITLES.length)
  })

  test('Empty Trash button is visible in trash view header', async ({ page }) => {
    await navigateToTrash(page)
    const emptyTrashBtn = page.locator('[data-testid="empty-trash-btn"]')
    await expect(emptyTrashBtn).toBeVisible()
  })

  test('Empty Trash button is NOT visible in normal "All Notes" view', async ({ page }) => {
    const emptyTrashBtn = page.locator('[data-testid="empty-trash-btn"]')
    await expect(emptyTrashBtn).not.toBeVisible()
  })

  test('Empty Trash command is available in command palette', async ({ page }) => {
    await openCommandPalette(page)
    const found = await findCommand(page, 'Empty Trash')
    expect(found).toBe(true)
  })

  test('Empty Trash shows confirmation dialog', async ({ page }) => {
    await navigateToTrash(page)
    const emptyTrashBtn = page.locator('[data-testid="empty-trash-btn"]')
    await emptyTrashBtn.click()
    const dialog = page.locator('[data-testid="confirm-delete-dialog"]')
    await expect(dialog).toBeVisible({ timeout: 3000 })
    await expect(dialog).toContainText('Empty Trash')
  })

  test('confirmation dialog can be cancelled', async ({ page }) => {
    await navigateToTrash(page)
    const emptyTrashBtn = page.locator('[data-testid="empty-trash-btn"]')
    await emptyTrashBtn.click()
    const dialog = page.locator('[data-testid="confirm-delete-dialog"]')
    await expect(dialog).toBeVisible({ timeout: 3000 })
    await page.locator('button').filter({ hasText: 'Cancel' }).click()
    await expect(dialog).not.toBeVisible()
    // Notes should still be in the list
    const noteItems = page.locator('[data-testid="note-item"]')
    const count = await noteItems.count()
    expect(count).toBeGreaterThanOrEqual(TRASHED_TITLES.length)
  })

  test('bulk selection in trash view shows Restore and Delete permanently buttons', async ({ page }) => {
    await navigateToTrash(page)
    // Select a note using Ctrl+Click
    const firstNote = page.locator('[data-testid="note-item"]').first()
    await firstNote.click({ modifiers: ['Control'] })
    await page.waitForTimeout(200)
    const bulkBar = page.locator('[data-testid="bulk-action-bar"]')
    await expect(bulkBar).toBeVisible({ timeout: 3000 })
    await expect(page.locator('[data-testid="bulk-restore-btn"]')).toBeVisible()
    await expect(page.locator('[data-testid="bulk-delete-btn"]')).toBeVisible()
    // Archive and Trash buttons should NOT be visible in trash view
    await expect(page.locator('[data-testid="bulk-archive-btn"]')).not.toBeVisible()
    await expect(page.locator('[data-testid="bulk-trash-btn"]')).not.toBeVisible()
  })

  test('bulk Delete permanently shows confirmation dialog', async ({ page }) => {
    await navigateToTrash(page)
    const firstNote = page.locator('[data-testid="note-item"]').first()
    await firstNote.click({ modifiers: ['Control'] })
    await page.waitForTimeout(200)
    const deleteBtn = page.locator('[data-testid="bulk-delete-btn"]')
    await expect(deleteBtn).toBeVisible({ timeout: 3000 })
    await deleteBtn.click()
    const dialog = page.locator('[data-testid="confirm-delete-dialog"]')
    await expect(dialog).toBeVisible({ timeout: 3000 })
    await expect(dialog).toContainText('permanently')
  })

  test('trashed note banner shows Restore and Delete permanently in editor', async ({ page }) => {
    await navigateToTrash(page)
    const firstNote = page.locator('[data-testid="note-item"]').first()
    await firstNote.click()
    await page.waitForTimeout(500)
    const banner = page.locator('[data-testid="trashed-note-banner"]')
    await expect(banner).toBeVisible({ timeout: 3000 })
    await expect(page.locator('[data-testid="trashed-banner-restore"]')).toBeVisible()
    await expect(page.locator('[data-testid="trashed-banner-delete"]')).toBeVisible()
  })

  test('bulk selection in normal view shows Archive and Trash (not Restore/Delete)', async ({ page }) => {
    // In normal view (All Notes)
    const firstNote = page.locator('[data-testid="note-item"]').first()
    await firstNote.click({ modifiers: ['Control'] })
    await page.waitForTimeout(200)
    const bulkBar = page.locator('[data-testid="bulk-action-bar"]')
    await expect(bulkBar).toBeVisible({ timeout: 3000 })
    await expect(page.locator('[data-testid="bulk-archive-btn"]')).toBeVisible()
    await expect(page.locator('[data-testid="bulk-trash-btn"]')).toBeVisible()
    await expect(page.locator('[data-testid="bulk-restore-btn"]')).not.toBeVisible()
    await expect(page.locator('[data-testid="bulk-delete-btn"]')).not.toBeVisible()
  })

  test('Empty Trash via command palette shows confirmation dialog', async ({ page }) => {
    await openCommandPalette(page)
    await executeCommand(page, 'Empty Trash')
    await page.waitForTimeout(300)
    const dialog = page.locator('[data-testid="confirm-delete-dialog"]')
    await expect(dialog).toBeVisible({ timeout: 3000 })
  })
})
