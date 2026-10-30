import { expect, type Page, test } from '@playwright/test'

import { sendShortcut } from './helpers'

async function openNoteViaQuickOpen(page: Page, query: string) {
  await page.locator('body').click()
  await sendShortcut(page, 'p', ['Control'])
  const searchInput = page.locator('input[placeholder="Search notes..."]')
  await expect(searchInput).toBeVisible()
  await searchInput.fill(query)
  await page.waitForTimeout(500)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(1000)
}

test.describe('Dynamic wikilink relationship detection', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('wikilink fields render as relationships, plain-text fields as properties', async ({ page }) => {
    // Open "Sponsorships" — has Has Measures/Has Procedures (custom wikilink arrays)
    // and Status: Open (plain text)
    await openNoteViaQuickOpen(page, 'Sponsorships')

    // Wait for note to load — Status should render as editable property
    const statusProp = page.locator('[data-testid="editable-property"]').filter({ hasText: 'Status' })
    await expect(statusProp).toBeVisible({ timeout: 5000 })
    await expect(statusProp.getByText('Open')).toBeVisible()

    // 'Has Measures' has wikilinks → should NOT be in Properties
    const measuresProp = page.locator('[data-testid="editable-property"]').filter({ hasText: 'Has Measures' })
    await expect(measuresProp).not.toBeVisible()

    // 'Has Measures' should appear as a relationship label
    const measuresLabel = page.locator('span.font-mono-overline').filter({ hasText: 'Has Measures' })
    await expect(measuresLabel).toBeVisible()

    // 'Has Procedures' has wikilinks → should be in Relationships
    const proceduresLabel = page.locator('span.font-mono-overline').filter({ hasText: 'Has Procedures' })
    await expect(proceduresLabel).toBeVisible()
  })

  test('existing wikilink relationships still render correctly', async ({ page }) => {
    // Open "Start Laputa App Project" — has Belongs to: [[24q4]], Owner: [[person-luca-rossi]]
    await openNoteViaQuickOpen(page, 'Start Laputa App')

    // Wait for note content to load
    const statusProp = page.locator('[data-testid="editable-property"]').first()
    await expect(statusProp).toBeVisible({ timeout: 5000 })

    // 'Belongs to' has wikilink → should be in Relationships (not Properties)
    const belongsToProp = page.locator('[data-testid="editable-property"]').filter({ hasText: 'Belongs to' })
    await expect(belongsToProp).not.toBeVisible()

    // 'Belongs to' should appear as a relationship label
    const belongsToLabel = page.locator('span.font-mono-overline').filter({ hasText: 'Belongs to' })
    await expect(belongsToLabel).toBeVisible()

    // 'Owner' has wikilink → should be in Relationships
    const ownerProp = page.locator('[data-testid="editable-property"]').filter({ hasText: 'Owner' })
    await expect(ownerProp).not.toBeVisible()
  })
})
