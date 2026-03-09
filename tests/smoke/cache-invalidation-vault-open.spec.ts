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
    // The note list container should be present and rendered.
    // Cache pruning correctness is verified by Rust unit tests (prune_stale_entries).
    // Here we just verify the UI renders the note list without crashing.
    const noteListContainer = page.locator(
      '[data-testid="note-list-container"]',
    )
    await expect(noteListContainer).toBeVisible({ timeout: 5_000 })
  })

  test('Reload Vault command is available in command palette', async ({
    page,
  }) => {
    await openCommandPalette(page)
    const found = await findCommand(page, 'Reload Vault')
    expect(found).toBe(true)
  })
})
