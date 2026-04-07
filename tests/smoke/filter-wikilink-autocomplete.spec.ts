import { test, expect, type Page } from '@playwright/test'

async function openCreateViewDialog(page: Page) {
  // The VIEWS header has a small + icon. Find the header button containing "VIEWS" text
  // and the + SVG icon next to it
  const viewsHeader = page.locator('button:has(span:text("VIEWS"))')
  await viewsHeader.waitFor({ timeout: 5000 })
  // The Plus icon is rendered as an SVG inside the same container
  // Click the SVG child of the VIEWS button container (the + icon)
  const plusSvg = viewsHeader.locator('svg').last()
  await plusSvg.click({ force: true })
  await expect(page.locator('text=Create View')).toBeVisible({ timeout: 5000 })
}

test.describe('Filter value input', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('default text filters use a plain text input instead of a dropdown', async ({ page }) => {
    await openCreateViewDialog(page)
    const dialog = page.getByRole('dialog')

    const valueInput = dialog.getByTestId('filter-value-input')
    await expect(valueInput).toBeVisible()
    await valueInput.fill('Project')
    await expect(valueInput).toHaveValue('Project')
    await expect(dialog.getByTestId('wikilink-dropdown')).toHaveCount(0)
  })

  test('wikilink-like text stays raw input with no autocomplete', async ({ page }) => {
    await openCreateViewDialog(page)
    const dialog = page.getByRole('dialog')

    const fieldSelect = dialog.locator('button:has-text("type")').first()
    await fieldSelect.click()
    await page.locator('[role="option"]:has-text("title")').click()

    const valueInput = dialog.getByTestId('filter-value-input')
    await valueInput.fill('[[un')

    await expect(valueInput).toHaveValue('[[un')
    await expect(dialog.getByTestId('wikilink-dropdown')).toHaveCount(0)
  })
})
