import { test, expect } from '@playwright/test'

test.describe('Renaming a note updates wikilinks across the vault', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('tab rename triggers rename flow and shows toast', async ({ page }) => {
    // 1. Click the first note in the list to open it
    const noteListContainer = page.locator('[data-testid="note-list-container"]')
    await noteListContainer.waitFor({ timeout: 5000 })
    const firstNote = noteListContainer.locator('.cursor-pointer').first()
    await firstNote.click()
    await page.waitForTimeout(500)

    // 2. Capture the original tab title
    const tabTitle = page.locator('.group span.truncate').first()
    await expect(tabTitle).toBeVisible({ timeout: 5000 })
    const originalTitle = await tabTitle.textContent()
    expect(originalTitle).toBeTruthy()

    // 3. Double-click the tab to enter rename mode
    await tabTitle.dblclick()
    await page.waitForTimeout(300)

    // 4. Type a new name and press Enter
    const editInput = page.locator('.group input')
    await expect(editInput).toBeVisible({ timeout: 3000 })
    const newTitle = `${originalTitle} Renamed`
    await editInput.fill(newTitle)
    await editInput.press('Enter')
    await page.waitForTimeout(1000)

    // 5. Verify the tab title updated (rename mock handler returns a new path)
    const newTabTitle = page.locator('.group span.truncate').first()
    await expect(newTabTitle).toHaveText(newTitle, { timeout: 5000 })

    // 6. Verify the toast message appeared (confirms rename flow ran, not just in-memory update)
    const toast = page.getByText('Renamed', { exact: true })
    await expect(toast).toBeVisible({ timeout: 5000 })
  })
})
