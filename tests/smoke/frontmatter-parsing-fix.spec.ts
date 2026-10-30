import { expect, type Page, test } from '@playwright/test'

import { sendShortcut } from './helpers'

const QUICK_OPEN_INPUT = 'input[placeholder="Search notes..."]'

async function openQuickOpen(page: Page) {
  await page.locator('body').click()
  await sendShortcut(page, 'p', ['Control'])
  await expect(page.locator(QUICK_OPEN_INPUT)).toBeVisible()
}

test.describe('Frontmatter parsing: type badge displays correctly', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('procedure note shows type badge in Quick Open', async ({ page }) => {
    await openQuickOpen(page)
    await page.locator(QUICK_OPEN_INPUT).fill('Weekly')
    await page.waitForTimeout(400)
    // The Badge component renders the type name as text content
    const badge = page.locator('.fixed.inset-0').locator('text=Procedure')
    await expect(badge.first()).toBeVisible({ timeout: 3000 })
  })

  test('responsibility note shows type badge in Quick Open', async ({ page }) => {
    await openQuickOpen(page)
    await page.locator(QUICK_OPEN_INPUT).fill('Newsletter')
    await page.waitForTimeout(400)
    const badge = page.locator('.fixed.inset-0').locator('text=Responsibility')
    await expect(badge.first()).toBeVisible({ timeout: 3000 })
  })

  test('project note shows type badge in Quick Open', async ({ page }) => {
    await openQuickOpen(page)
    await page.locator(QUICK_OPEN_INPUT).fill('Laputa')
    await page.waitForTimeout(400)
    const badge = page.locator('.fixed.inset-0').locator('text=Project')
    await expect(badge.first()).toBeVisible({ timeout: 3000 })
  })

  test('sidebar shows type sections', async ({ page }) => {
    // Sidebar sections are rendered as nav items — look for them in the page
    await expect(page.locator('text=Projects').first()).toBeVisible({ timeout: 3000 })
    await expect(page.locator('text=Responsibilities').first()).toBeVisible({ timeout: 3000 })
  })
})
