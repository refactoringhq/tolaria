import { expect, type Page, test } from '@playwright/test'

import { openCommandPalette, executeCommand } from './helpers'

async function navigateToChanges(page: Page) {
  await openCommandPalette(page)
  await executeCommand(page, 'Go to Changes')
  await page.waitForTimeout(500)
}

async function expectDeletedNotePreview(page: Page) {
  const editor = page.locator('.app__editor')
  await expect(editor.getByRole('heading', { name: 'Old Draft' })).toBeVisible({ timeout: 5_000 })
  await expect(editor.getByText('This note was deleted.')).toBeVisible()
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
    const rowCount = await noteList.getByRole('option').count()
    for (let step = 0; step < rowCount; step++) {
      if (await deletedRow.getAttribute('aria-selected') === 'true') break
      await noteList.press('ArrowDown')
    }
    await expect(deletedRow).toHaveAttribute('aria-selected', 'true')
    await noteList.press('Enter')
    await expectDeletedNotePreview(page)
  })

  test('changes view shows deleted notes as rows instead of a banner', async ({ page }) => {
    await navigateToChanges(page)
    const deletedRow = page.locator('[data-change-status="deleted"]').filter({ hasText: 'old-draft.md' })
    await expect(deletedRow).toBeVisible({ timeout: 5000 })
    await expect(page.locator('[data-testid="deleted-notes-banner"]')).toHaveCount(0)
  })

  test('clicking a deleted row opens its deleted note preview', async ({ page }) => {
    await navigateToChanges(page)
    await page.getByText('old-draft.md').click()
    await expectDeletedNotePreview(page)
  })

  test('deleted rows expose a restore action from the context menu', async ({ page }) => {
    await navigateToChanges(page)
    await page.getByText('old-draft.md').click({ button: 'right' })
    await expect(page.locator('[data-testid="changes-context-menu"]')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('[data-testid="restore-note-button"]')).toBeVisible({ timeout: 5000 })
  })
})
