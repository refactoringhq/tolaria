import { expect, type Page, test } from '@playwright/test'

import { sendShortcut } from './helpers'

const QUICK_OPEN_INPUT = 'input[placeholder="Search notes..."]'

async function openQuickOpen(page: Page) {
  await page.locator('body').click()
  await sendShortcut(page, 'p', ['Control'])
  await expect(page.locator(QUICK_OPEN_INPUT)).toBeVisible()
}

/**
 * Get the title text of the first (selected) search result in the Quick Open palette.
 * The selected item has `bg-accent` class, and the title is in a nested `.truncate` span.
 */
async function getFirstResultTitle(page: Page): Promise<string> {
  // The selected result row contains the title in a span.truncate
  const titleSpan = page.getByTestId('quick-open-palette').locator('[class*="bg-accent"] span.truncate')
  await titleSpan.first().waitFor({ timeout: 3000 })
  return (await titleSpan.first().textContent()) ?? ''
}

test.describe('Exact match search ranking', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('exact title match appears as first result', async ({ page }) => {
    await openQuickOpen(page)
    // "Writing" is a Topic note in the demo vault; other notes have "Writing" as a prefix
    await page.locator(QUICK_OPEN_INPUT).fill('Writing')
    await page.waitForTimeout(300)

    const firstTitle = await getFirstResultTitle(page)
    expect(firstTitle).toBe('Writing')
  })

  test('case-insensitive exact match appears first', async ({ page }) => {
    await openQuickOpen(page)
    await page.locator(QUICK_OPEN_INPUT).fill('writing')
    await page.waitForTimeout(300)

    const firstTitle = await getFirstResultTitle(page)
    expect(firstTitle).toBe('Writing')
  })

  test('partial matches still appear below exact match', async ({ page }) => {
    await openQuickOpen(page)
    await page.locator(QUICK_OPEN_INPUT).fill('Writing')
    await page.waitForTimeout(300)

    // Should have multiple results (exact + prefix/fuzzy matches)
    const resultRows = page.locator('[class*="cursor-pointer"][class*="items-center"]')
    const count = await resultRows.count()
    expect(count).toBeGreaterThan(1)

    // First result is the exact match
    const firstTitle = await getFirstResultTitle(page)
    expect(firstTitle).toBe('Writing')
  })

  test('arrow keys navigate search results past the exact match', async ({ page }) => {
    await openQuickOpen(page)
    await page.locator(QUICK_OPEN_INPUT).fill('Writing')
    await page.waitForTimeout(300)

    // First result should be selected (exact match)
    const firstTitle = await getFirstResultTitle(page)
    expect(firstTitle).toBe('Writing')

    // ArrowDown moves to next result (a prefix or fuzzy match)
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(100)
    const secondTitle = await getFirstResultTitle(page)
    expect(secondTitle).not.toBe('Writing')
  })
})
