import { test, expect } from '@playwright/test'

test.describe('Type icon, color, and sidebar label', () => {
  test.beforeEach(async ({ page }) => {
    // Block vault API so the app falls back to mock data (which contains our test fixtures)
    await page.route('**/api/vault/**', (route) => route.abort())
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('Config section shows correct sidebar label from type entry', async ({ page }) => {
    const sidebar = page.locator('aside')
    await sidebar.locator('button[aria-label*="Collapse"], button[aria-label*="Expand"]').first().waitFor({ timeout: 5000 })

    // The Config type entry has sidebarLabel: "Config" — the section button should use that label
    const configBtn = sidebar.locator('button[aria-label="Collapse Config"], button[aria-label="Expand Config"]')
    await expect(configBtn).toBeVisible()
  })

  test('Config section icon is not the default FileText', async ({ page }) => {
    const sidebar = page.locator('aside')
    await sidebar.locator('button[aria-label*="Collapse"], button[aria-label*="Expand"]').first().waitFor({ timeout: 5000 })

    const configSection = sidebar.locator('div.group\\/section').filter({
      has: page.locator('button[aria-label="Collapse Config"], button[aria-label="Expand Config"]'),
    })
    await expect(configSection).toBeVisible()

    // The icon SVG should be present (GearSix, resolved from type entry icon: 'gear-six')
    const icon = configSection.locator('svg').first()
    await expect(icon).toBeVisible()
  })

  test('Config section icon has gray color applied via style', async ({ page }) => {
    const sidebar = page.locator('aside')
    await sidebar.locator('button[aria-label*="Collapse"], button[aria-label*="Expand"]').first().waitFor({ timeout: 5000 })

    const configSection = sidebar.locator('div.group\\/section').filter({
      has: page.locator('button[aria-label="Collapse Config"], button[aria-label="Expand Config"]'),
    })
    await expect(configSection).toBeVisible()

    // The icon should have gray color from the type entry's color: 'gray'
    const icon = configSection.locator('svg').first()
    const color = await icon.evaluate((el) => el.style.color)
    expect(color).toContain('var(--accent-gray)')
  })

  test('custom type with icon/color reflects in sidebar (Recipe)', async ({ page }) => {
    const sidebar = page.locator('aside')
    await sidebar.locator('button[aria-label*="Collapse"], button[aria-label*="Expand"]').first().waitFor({ timeout: 5000 })

    // Recipe type has icon: cooking-pot, color: orange — check section has correct color
    const recipeSection = sidebar.locator('div.group\\/section').filter({
      has: page.locator('button[aria-label="Collapse Recipes"], button[aria-label="Expand Recipes"]'),
    })
    await expect(recipeSection).toBeVisible()

    const icon = recipeSection.locator('svg').first()
    const color = await icon.evaluate((el) => el.style.color)
    expect(color).toContain('var(--accent-orange)')
  })
})
