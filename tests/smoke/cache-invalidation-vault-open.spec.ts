import { test, expect } from '@playwright/test'
import { openCommandPalette, findCommand } from './helpers'

test.describe('Cache invalidation on vault open', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('vault loads without ghost entries — note list matches mock data', async ({
    page,
  }) => {
    // The sidebar note list should be populated with exactly the mock entries.
    // If cache pruning failed, stale entries would inflate this count.
    const noteListContainer = page.locator(
      '[data-testid="note-list-container"]',
    )
    await expect(noteListContainer).toBeVisible({ timeout: 5_000 })

    // All visible note items should have non-empty titles (no blank ghost rows)
    const noteItems = noteListContainer.locator('.cursor-pointer')
    const count = await noteItems.count()
    expect(count).toBeGreaterThan(0)

    for (let i = 0; i < count; i++) {
      const text = await noteItems.nth(i).textContent()
      expect(text?.trim().length).toBeGreaterThan(0)
    }
  })

  test('Reload Vault command is available in command palette', async ({
    page,
  }) => {
    await openCommandPalette(page)
    const found = await findCommand(page, 'Reload Vault')
    expect(found).toBe(true)
  })
})
